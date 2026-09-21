import {
  expect,
  test,
} from '@playwright/test';

function requiredEnvironment(
  name: string,
) {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `${name} is required for browser E2E`,
    );
  }

  return value;
}

const ADMIN_EMAIL =
  requiredEnvironment(
    'SG_E2E_ADMIN_EMAIL',
  );

const ADMIN_PASSWORD =
  requiredEnvironment(
    'SG_E2E_ADMIN_PASSWORD',
  );

test(
  'customer can browse product and add variant to cart',
  async ({
    page,
  }) => {
    await page.goto(
      'http://localhost:3100/products',
    );

    await expect(
      page.getByRole(
        'heading',
        {
          name: 'Products',
        },
      ),
    ).toBeVisible();

    await page.goto(
      'http://localhost:3100/products/classic-cotton-t-shirt',
    );

    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'Classic Cotton T-Shirt',
        },
      ),
    ).toBeVisible();

    await page
      .getByRole(
        'button',
        {
          name: 'Add to cart',
        },
      )
      .click();

    await page.goto(
      'http://localhost:3100/cart',
    );

    await expect(
      page.getByText(
        'Classic Cotton T-Shirt',
      ),
    ).toBeVisible();

    await expect(
      page.getByRole(
        'link',
        {
          name:
            'Continue to checkout',
        },
      ),
    ).toBeVisible();
  },
);

test(
  'customer registration and account work',
  async ({
    page,
  }) => {
    const stamp =
      Date.now();

    await page.goto(
      'http://localhost:3100/register',
    );

    await page
      .getByPlaceholder(
        'Full name',
      )
      .fill(
        'Browser Customer',
      );

    await page
      .getByPlaceholder(
        'Email',
      )
      .fill(
        `browser-${stamp}@example.com`,
      );

    await page
      .getByPlaceholder(
        'Phone',
      )
      .fill(
        `016${String(stamp).slice(-8)}`,
      );

    await page
      .getByPlaceholder(
        'Password',
      )
      .fill(
        'Browser123!',
      );

    await page
      .getByRole(
        'button',
        {
          name:
            'Create account',
        },
      )
      .click();

    await expect(
      page,
    ).toHaveURL(
      /\/account/,
    );

    await expect(
      page.getByText(
        'Customer account',
      ),
    ).toBeVisible();
  },
);

test(
  'admin is protected and login works',
  async ({
    page,
  }) => {
    await page.goto(
      'http://localhost:3101/orders',
    );

    await expect(
      page,
    ).toHaveURL(
      /\/login/,
    );

    await page
      .getByPlaceholder(
        'Admin email',
      )
      .fill(
        ADMIN_EMAIL,
      );

    await page
      .getByPlaceholder(
        'Password',
      )
      .fill(
        ADMIN_PASSWORD,
      );

    await page
      .getByRole(
        'button',
        {
          name: 'Sign in',
        },
      )
      .click();

    await expect(
      page,
    ).not.toHaveURL(
      /\/login/,
    );

    await page.goto(
      'http://localhost:3101/orders',
    );

    await expect(
      page.getByRole(
        'heading',
        {
          name: 'Orders',
        },
      ),
    ).toBeVisible();
  },
);
