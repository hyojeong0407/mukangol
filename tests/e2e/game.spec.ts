import { expect, test, type Page } from '@playwright/test';

// 규칙 흐름 테스트는 배경 연출(Phaser)과 음성 없이 돌린다. 연출 레이어는 아래 별도 테스트에서 확인한다.
test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(() => {
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
    return { civilian: s.board.civilianId as string, all: Object.keys(s.board.profiles) as string[] };
  });
}

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '새 게임' }).click();
  await settle(page); // 프롤로그 → 오프닝
  await page.getByRole('button', { name: /첫 새벽을 맞는다/ }).click();
  await settle(page); // 1일차 새벽 → 사건 일지
}

/** 질문 포인트를 다 쓸 때까지 요괴를 골라 묻는다 (매일 2개) */
async function interrogate(page: Page) {
  const btn = page.locator('[data-action="ask"]:not([disabled])');
  for (let i = 0; i < 10 && (await btn.count()) > 0; i++) {
    await btn.nth(i % (await btn.count())).click();
    await settle(page);
  }
  await expect(page.locator('.hint-group li')).not.toHaveCount(0); // 보고 후 심문 일지
}

async function playToFinal(page: Page) {
  await start(page);
  for (let day = 1; day <= 5; day++) {
    if (day < 5) {
      await expect(page.locator('.book')).toBeVisible();
      await page.locator('[data-action="advance"]').click(); // 오전 → 오후
      await settle(page);
    }
    await interrogate(page);
    await page.locator('[data-action="advance"]').click(); // 오후 → 밤 / 처형
    await settle(page);
    if (day < 5) {
      await expect(page.locator('.suspect-card')).toHaveCount(5);
      await page.locator('[data-action="advance"]').click(); // 밤 → 다음 새벽 → 사건 일지
      await settle(page);
    }
  }
  await expect(page.getByRole('heading', { name: /5일차 처형/ })).toBeVisible();
}

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

test('해피 엔딩 경로', async ({ page }) => {
  const heard = listenBgm(page);
  await playToFinal(page);
  const a = await answer(page);
  await pick(
    page,
    a.all.filter((x) => x !== a.civilian),
  );
  await expect(page.getByRole('heading', { name: '해피 엔딩' })).toBeVisible();
  await expect.poll(() => heard.at(-1)).toBe('bgm-ending-happy'); // 처형 곡 다음 해피 엔딩 곡
  expect(heard).toContain('bgm-ending');
});

test('게임 오버 경로', async ({ page }) => {
  const heard = listenBgm(page);
  await playToFinal(page);
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

test('심문 일지는 요괴 이름으로, 구속하면 항변한다', async ({ page }) => {
  await start(page);
  await page.locator('[data-action="advance"]').click();
  await settle(page);
  await interrogate(page);
  const titles = await page.locator('.hint-group h3').allInnerTexts();
  expect(titles.join(' ')).toMatch(/호랑이|두억시니|도깨비|처녀귀신|구미호/);
  await page.locator('[data-action="advance"]').click();
  await settle(page);
  await page.locator('[data-action="detain"]').first().click();
  await expect(page.locator('.speech-bubble')).toBeVisible();
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
  await expect(page.getByRole('button', { name: /첫 새벽을 맞는다/ })).toBeVisible();
  expect(errors).toEqual([]);
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
