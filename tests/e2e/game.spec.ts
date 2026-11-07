import { expect, test, type Page } from '@playwright/test';

// 규칙 흐름 테스트는 배경 연출(Phaser)과 음성 없이 돌린다. 연출 레이어는 아래 별도 테스트에서 확인한다.
test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(() => {
    // 새로고침해도 설정(이미 본 안내 등)이 남도록, 처음 한 번만 넣는다
    if (!localStorage.getItem('mukangol.settings.v1'))
      localStorage.setItem('mukangol.settings.v1', JSON.stringify({ autoAdvance: true, reduceMotion: true }));
  });
  if (!info.title.includes('연출')) await page.route('**/fx-*.js', (r) => r.abort());
});

/** 이어지는 컷신을 모두 건너뛴다. 컷신이 0.6초 동안 다시 뜨지 않으면 끝 */
async function settle(page: Page) {
  const cs = page.locator('#cutscene');
  for (let quiet = 0; quiet < 3;) {
    if (await cs.isVisible()) {
      await page
        .locator('[data-cs="skip"]')
        .click({ timeout: 2000 })
        .catch(() => undefined);
      quiet = 0;
    } else quiet++;
    await page.waitForTimeout(200);
  }
}

/** 저장 데이터에서 정답을 읽는다 (테스트 전용). 실제 플레이어 화면에는 정답이 없다. */
async function answer(page: Page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('mukangol.save.v1')!);
    return {
      civilian: s.board.civilianId as string,
      all: Object.keys(s.board.profiles) as string[],
      eventOrder: s.board.eventOrder as string[],
    };
  });
}

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '새 게임' }).click();
  await settle(page); // 프롤로그 → 오프닝
  await page.locator('.tut-skip').click(); // 조사 방법 카드 건너뛰기
  await settle(page); // 1일차 새벽 → 사건 일지
}

/** 옥사를 비우고 ids를 가둔다 (오전·밤) */
async function jail(page: Page, ids: string[]) {
  const release = page.locator('.suspect-card.is-detained [data-action="detain"]');
  while ((await release.count()) > 0) await release.first().click();
  for (const id of ids) await page.locator(`[data-action="detain"][data-id="${id}"]`).click();
  await expect(page.locator('.suspect-card.is-detained')).toHaveCount(ids.length);
}

/** 질문 포인트를 다 쓸 때까지 갇힌 자를 골라 묻는다 (매일 2개) */
async function interrogate(page: Page) {
  const btn = page.locator('[data-action="ask"]:not([disabled])');
  for (let i = 0; i < 10 && (await btn.count()) > 0; i++) {
    await btn.nth(i % (await btn.count())).click();
    await settle(page);
  }
  await expect(page.locator('.hint-group li')).not.toHaveCount(0); // 보고 후 심문 일지
}

/**
 * 5일차 처형장까지. 오전에는 civilian+다른 한 명을 가두고 묻는다.
 * 밤에는 blockNight(day)가 돌려준 사람을 가둔다 (다음 날 범인을 가두면 옥사 이변).
 */
async function playToFinal(
  page: Page,
  blockNight: (day: number, a: Awaited<ReturnType<typeof answer>>) => string[],
) {
  await start(page);
  const a = await answer(page);
  const others = a.all.filter((x) => x !== a.civilian);
  for (let day = 1; day <= 5; day++) {
    if (day < 5) {
      await expect(page.locator('.book')).toBeVisible();
      await jail(page, [a.civilian, others[day % others.length]]); // 오전: 오후에 물을 사람
      await page.locator('[data-action="advance"]').click(); // 오전 → 오후
      await settle(page);
    }
    await interrogate(page);
    await page.locator('[data-action="advance"]').click(); // 오후 → 밤 / 처형
    await settle(page);
    if (day < 5) {
      await expect(page.locator('.suspect-card')).toHaveCount(5);
      await jail(page, blockNight(day, a)); // 밤: 오늘 밤 가둘 사람
      await page.locator('[data-action="advance"]').click(); // 밤 → 다음 새벽 → 사건 일지
      await settle(page);
    }
  }
  await expect(page.getByRole('heading', { name: /5일차 처형/ })).toBeVisible();
}

/** 다음 날 범인과 민간인을 가둔다 → 사건이 모두 막힌다 (희생자 1) */
const blockAll = (day: number, a: Awaited<ReturnType<typeof answer>>) =>
  day < 4 ? [a.eventOrder[day], a.civilian] : [a.civilian, a.eventOrder[0]];
/** 민간인과 1일차 범인만 가둔다 → 아무것도 막지 못한다 (희생자 4) */
const blockNone = (_: number, a: Awaited<ReturnType<typeof answer>>) => [a.civilian, a.eventOrder[0]];

async function pick(page: Page, ids: string[]) {
  for (const id of ids) await page.locator(`[data-action="pick"][data-id="${id}"]`).click();
  await page.locator('[data-action="execute-open"]').click();
  await page.locator('[data-action="execute-confirm"]').click();
  await settle(page); // 처형 집행 연출
}

/** 요청된 배경음 파일 이름을 순서대로 모은다 */
function listenBgm(page: Page) {
  const heard: string[] = [];
  page.on('request', (r) => {
    const m = r.url().match(/audio\/(bgm-[a-z-]+)\.ogg/);
    if (m && heard.at(-1) !== m[1]) heard.push(m[1]);
  });
  return heard;
}

test('해피 엔딩 경로 (사건을 막아 옥사 이변이 기록된다)', async ({ page }) => {
  const heard = listenBgm(page);
  await playToFinal(page, blockAll);
  await page.locator('[data-action="view"][data-view="caselog"]').click();
  await page.locator('[data-action="caseday"][data-day="2"]').click();
  await expect(page.locator('.book.is-prevented')).toBeVisible();
  await expect(page.locator('.book-head')).toContainText('옥사 이변');
  await expect(page.locator('.hud-tally')).toContainText('희생 1');
  await page.locator('[data-action="view"][data-view="today"]').click();
  const a = await answer(page);
  await pick(
    page,
    a.all.filter((x) => x !== a.civilian),
  );
  await expect(page.getByRole('heading', { name: '해피 엔딩' })).toBeVisible();
  await expect(page.locator('.ending-tally')).toContainText('희생자 1명');
  await expect.poll(() => heard.at(-1)).toBe('bgm-ending-happy'); // 처형 곡 다음 해피 엔딩 곡
  expect(heard).toContain('bgm-ending');
});

test('희생자가 넷이면 요괴를 다 가려내도 씁쓸한 엔딩', async ({ page }) => {
  await playToFinal(page, blockNone);
  const a = await answer(page);
  await pick(
    page,
    a.all.filter((x) => x !== a.civilian),
  );
  await expect(page.getByRole('heading', { name: '씁쓸한 엔딩' })).toBeVisible();
  await expect(page.locator('.ending-tally')).toContainText('희생자 4명');
});

test('게임 오버 경로', async ({ page }) => {
  const heard = listenBgm(page);
  await playToFinal(page, blockAll);
  const a = await answer(page);
  await pick(page, [a.civilian, ...a.all.filter((x) => x !== a.civilian).slice(0, 3)]);
  await expect(page.getByRole('heading', { name: '게임 오버' })).toBeVisible();
  await expect.poll(() => heard.at(-1)).toBe('bgm-ending-gameover');
});

test('이어하기와 기록판 사건별 표시', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /이어하기/ })).toBeDisabled();
  await start(page);
  await page.locator('[data-action="view"][data-view="board"]').click();
  await expect(page.locator('.case-card')).toBeVisible();
  const cell = page.locator('[data-action="mark"]').first();
  await cell.click();
  await expect(cell.locator('.stamp')).toHaveText('가능');
  await page.reload();
  await page.getByRole('button', { name: /이어하기/ }).click();
  await page.locator('[data-action="view"][data-view="board"]').click();
  await expect(page.locator('[data-action="mark"]').first().locator('.stamp')).toHaveText('가능');
});

test('오전에 가두면 항변하고, 갇힌 자만 심문하며, 심문 일지는 요괴 이름으로', async ({ page }) => {
  await start(page);
  await page.locator('[data-action="detain"][data-id="mul"]').click();
  await expect(page.locator('.speech-bubble')).toBeVisible();
  await page.locator('[data-action="detain"][data-id="beomgol"]').click();
  await expect(page.locator('[data-action="detain"][data-id="soedol"]')).toBeVisible();
  await page.locator('[data-action="advance"]').click();
  await settle(page);
  // 질문 버튼은 갇힌 둘뿐
  await expect(page.locator('[data-action="ask"]')).toHaveCount(2);
  await interrogate(page);
  const titles = await page.locator('.hint-group h3').allInnerTexts();
  expect(titles.join(' ')).toMatch(/호랑이|두억시니|도깨비|처녀귀신|구미호/);
});

test('옥이 비어 있으면 심문 없이 밤으로 넘어간다', async ({ page }) => {
  await start(page);
  await page.locator('[data-action="advance"]').click();
  await settle(page);
  await expect(page.locator('.speech')).toContainText('옥이 비어');
  await expect(page.locator('[data-action="ask"]')).toHaveCount(0);
  await page.locator('[data-action="advance"]').click();
  await settle(page);
  await expect(page.locator('.prison')).toBeVisible();
});

test('대사 자동 넘김을 껐다 켜도 컷신이 멈추지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 게임' }).click();
  const text = page.locator('.cs-text');
  await expect(text).not.toBeEmpty();
  await page.locator('[data-cs="auto"]').click(); // 끄기
  await expect(page.locator('[data-cs="auto"]')).toHaveText('수동 ⏸');
  const before = await text.innerText();
  await page.waitForTimeout(2500);
  expect(await text.innerText()).toBe(before); // 수동: 그대로
  await page.locator('[data-cs="auto"]').click(); // 다시 켜기
  await expect(text).not.toHaveText(before, { timeout: 5000 }); // 저절로 다음 대사
});

test('연출 레이어와 컷신이 오류 없이 뜬다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#fx canvas')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '새 게임' }).click();
  await expect(page.locator('.cs-root')).toBeVisible();
  await page.locator('.cs-root').click(); // 한 장면 넘기기
  await settle(page);
  // 조사 방법: 카드를 끝까지 넘기면 "첫 새벽을 맞는다"
  await expect(page.locator('.tut-card')).toBeVisible();
  const cards = await page.locator('.tut-dot').count();
  for (let i = 1; i < cards; i++) await page.getByRole('button', { name: '다음 ›' }).click();
  await expect(page.getByRole('button', { name: /첫 새벽을 맞는다/ })).toBeVisible();
  await page.getByRole('button', { name: '‹ 이전' }).click();
  await expect(page.locator('.tut-count')).toContainText(`${cards - 1} / ${cards}`);
  expect(errors).toEqual([]);
});

test('처음 안내는 한 번 보면 다시 뜨지 않고, 대사의 강조가 형광펜으로 보인다', async ({ page }) => {
  await start(page);
  const tip = page.locator('.coach');
  await expect(tip).toBeVisible();
  await expect(tip.locator('em.hl').first()).toBeVisible();
  await tip.getByRole('button', { name: '알겠습니다' }).click();
  await expect(page.locator('.coach')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  await expect(page.locator('.prison')).toBeVisible();
  await expect(page.locator('.coach')).toHaveCount(0);
});

test('사건 일지 재생 중에는 아래 대사창이 보이지 않는다', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('mukangol.settings.v1', JSON.stringify({ autoAdvance: false, reduceMotion: true })),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '새 게임' }).click();
  await settle(page); // 프롤로그 → 오프닝
  await page.locator('.tut-skip').click(); // 조사 방법 건너뛰기
  await expect(page.locator('.cs-root')).toBeVisible(); // 1일차 새벽
  for (let i = 0; i < 30; i++) {
    if ((await page.locator('.cs-root').getAttribute('data-kind')) === 'journal') break;
    await page.locator('.cs-root').click();
  }
  await expect(page.locator('.cs-root')).toHaveAttribute('data-kind', 'journal');
  await expect(page.locator('.cs-book')).toBeVisible();
  // 같은 글은 화면 읽기 프로그램용으로만 남고 화면에는 보이지 않는다
  expect(await page.locator('.cs-box').evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(3);
  await expect(page.locator('.cs-tap')).toBeVisible();
});

test('화면마다 동업자 배경음이 바뀐다 (audio-spec.md)', async ({ page }) => {
  const heard: string[] = [];
  page.on('request', (r) => {
    const m = r.url().match(/audio\/(bgm-[a-z-]+)\.ogg/);
    if (m && heard.at(-1) !== m[1]) heard.push(m[1]);
  });
  await page.goto('/');
  await page.locator('.title-screen').click({ position: { x: 5, y: 5 } }); // 첫 입력 → 소리 허용
  await expect.poll(() => heard.at(-1)).toBe('bgm-title');
  await start(page); // 1일차 오전 사건 일지
  await expect.poll(() => heard.at(-1)).toBe('bgm-reasoning');
  expect(heard).toContain('bgm-dawn'); // 새벽 사건 보고 곡 (일지 전에 지나감)
  await page.locator('[data-action="advance"]').click(); // 오후 옥사
  await settle(page);
  await expect.poll(() => heard).toContain('bgm-interrogation');
});
