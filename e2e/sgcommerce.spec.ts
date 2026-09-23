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
      .first()
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
  'customer registration uses HttpOnly session and account works',
  async ({
    page,
  }) => {
    const stamp =
      Date.now();

    await page.goto(
      'http://localhost:3100/register',
    );

    /*
     * Simulate a browser that visited an older SgCommerce
     * release. The new login/registration flow must remove
     * the old Web Storage credential automatically.
     */
    await page.evaluate(
      () => {
        window.localStorage.setItem(
          'sgcommerce-customer-token',
          'legacy-browser-token',
        );
      },
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
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();

    /*
     * Security regression:
     * the authentication credential must exist only as an
     * HttpOnly cookie. Browser JavaScript must not be able
     * to retrieve it from localStorage or document.cookie.
     */
    const cookies =
      await page.context()
        .cookies(
          'http://localhost:3100',
        );

    const sessionCookie =
      cookies.find(
        (cookie) =>
          cookie.name ===
          'sg_customer_session',
      );

    expect(
      sessionCookie,
    ).toBeTruthy();

    expect(
      sessionCookie?.httpOnly,
    ).toBe(
      true,
    );

    expect(
      sessionCookie?.sameSite,
    ).toBe(
      'Lax',
    );

    expect(
      await page.evaluate(
        () =>
          window.localStorage.getItem(
            'sgcommerce-customer-token',
          ),
      ),
    ).toBeNull();

    const visibleCookies =
      await page.evaluate(
        () =>
          document.cookie,
      );

    expect(
      visibleCookies,
    ).not.toContain(
      'sg_customer_session=',
    );

    expect(
      visibleCookies,
    ).not.toContain(
      sessionCookie?.value ??
        'missing-session',
    );
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


test(
  'customer address persists after save and reload',
  async ({
    page,
  }) => {
    const stamp =
      Date.now();

    const email =
      `browser-address-${stamp}@example.com`;

    const phone =
      `018${String(
        stamp,
      ).slice(-8)}`;

    await page.goto(
      'http://localhost:3100/register',
    );

    await page
      .locator(
        'input[name="name"]',
      )
      .fill(
        'Browser Address Customer',
      );

    await page
      .locator(
        'input[name="email"]',
      )
      .fill(
        email,
      );

    await page
      .locator(
        'input[name="phone"]',
      )
      .fill(
        phone,
      );

    await page
      .locator(
        'input[name="password"]',
      )
      .fill(
        'Browser123!',
      );

    await page
      .getByRole(
        'button',
        {
          name:
            /register|create account|sign up/i,
        },
      )
      .click();

    await expect(
      page,
    ).toHaveURL(
      /\/account/,
      {
        timeout:
          10000,
      },
    );

    const form =
      page
        .locator(
          'form',
        )
        .filter({
          has:
            page.getByRole(
              'button',
              {
                name:
                  /save address/i,
              },
            ),
        });

    await form
      .locator(
        'input[name="label"]',
      )
      .fill(
        'Home',
      );

    await form
      .locator(
        'input[name="addressLine1"]',
      )
      .fill(
        'House 12, Road 4',
      );

    const line2 =
      form.locator(
        'input[name="addressLine2"]',
      );

    if (
      await line2.count()
    ) {
      await line2.fill(
        'Flat 3B',
      );
    }

    await form
      .locator(
        'input[name="city"]',
      )
      .fill(
        'Dhaka',
      );

    await form
      .locator(
        'input[name="area"]',
      )
      .fill(
        'Mirpur 2',
      );

    const postal =
      form.locator(
        'input[name="postalCode"]',
      );

    if (
      await postal.count()
    ) {
      await postal.fill(
        '1216',
      );
    }

    await form
      .locator(
        'select[name="zone"]',
      )
      .selectOption(
        'inside_dhaka',
      );

    await form
      .locator(
        'input[name="isDefault"]',
      )
      .check();

    await page
      .getByRole(
        'button',
        {
          name:
            /save address/i,
        },
      )
      .click();

    await expect(
      page.getByRole(
        'status',
      ),
    ).toContainText(
      'Address saved successfully',
    );

    await expect(
      page.getByText(
        'House 12, Road 4',
        {
          exact:
            false,
        },
      ),
    ).toBeVisible();

    await expect(
      page.getByText(
        /Home.*Default/i,
      ),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByText(
        'House 12, Road 4',
        {
          exact:
            false,
        },
      ),
    ).toBeVisible({
      timeout:
        10000,
    });

    await expect(
      page.getByText(
        /Home.*Default/i,
      ),
    ).toBeVisible();
  },
);

test(
  'customer cart survives reload',
  async ({
    page,
  }) => {
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
          name:
            /add to cart/i,
        },
      )
      .first()
      .click();

    await page.goto(
      'http://localhost:3100/cart',
    );

    await expect(
      page.getByText(
        'Classic Cotton T-Shirt',
        {
          exact:
            false,
        },
      ).first(),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByText(
        'Classic Cotton T-Shirt',
        {
          exact:
            false,
        },
      ).first(),
    ).toBeVisible({
      timeout:
        7500,
    });
  },
);


test(
  'signed-in customer does not need order lookup forms',
  async ({
    page,
  }) => {
    const stamp =
      Date.now();

    const email =
      `browser-orders-${stamp}@example.com`;

    const phone =
      `017${String(
        stamp,
      ).slice(-8)}`;

    /*
     * Register through the storefront BFF so the browser
     * receives the same HttpOnly session cookie used in
     * production.
     */
    const registration =
      await page.request.post(
        'http://localhost:3100/api/customer/register',
        {
          data: {
            name:
              'Browser Orders Customer',

            email,

            phone,

            password:
              'Browser123!',
          },
        },
      );

    expect(
      registration.ok(),
    ).toBeTruthy();

    const cookies =
      await page.context()
        .cookies(
          'http://localhost:3100',
        );

    expect(
      cookies.some(
        (cookie) =>
          cookie.name ===
            'sg_customer_session' &&
          cookie.httpOnly,
      ),
    ).toBeTruthy();

    await page.goto(
      'http://localhost:3100/orders',
    );

    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'My orders',
        },
      ),
    ).toBeVisible();

    await expect(
      page.getByText(
        'No orders yet',
      ),
    ).toBeVisible();

    expect(
      await page
        .locator(
          'input[name="orderNumber"]',
        )
        .count(),
    ).toBe(
      0,
    );

    expect(
      await page
        .locator(
          'input[name="phone"]',
        )
        .count(),
    ).toBe(
      0,
    );

    await page.goto(
      'http://localhost:3100/returns',
    );

    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'Returns',
        },
      ),
    ).toBeVisible();

    await expect(
      page.getByText(
        'No delivered orders ready for return',
      ),
    ).toBeVisible();

    expect(
      await page
        .locator(
          'input[name="orderNumber"]',
        )
        .count(),
    ).toBe(
      0,
    );

    expect(
      await page
        .locator(
          'input[name="phone"]',
        )
        .count(),
    ).toBe(
      0,
    );

    const mine =
      await page.request.get(
        'http://localhost:3100/api/customer/backend/returns/me',
      );

    expect(
      mine.status(),
    ).toBe(
      200,
    );

    expect(
      await mine.json(),
    ).toEqual(
      [],
    );
  },
);

test(
  'catalog supports quick add and global footer',
  async ({
    page,
  }) => {
    await page.goto(
      'http://localhost:3100/products?q=Classic%20Cotton%20T-Shirt',
    );

    await expect(
      page.getByRole(
        'contentinfo',
      ),
    ).toBeVisible();

    const card =
      page.locator(
        '[data-product-card="classic-cotton-t-shirt"]',
      );

    await expect(
      card,
    ).toBeVisible();

    await expect(
      card.getByRole(
        'button',
        {
          name:
            'Add to cart',
        },
      ),
    ).toBeVisible();

    const before =
      page.url();

    await card
      .getByRole(
        'button',
        {
          name:
            'Add to cart',
        },
      )
      .first()
      .click();

    await expect(
      card.getByRole(
        'status',
      ),
    ).toContainText(
      'Added to cart',
    );

    expect(
      page.url(),
    ).toBe(
      before,
    );

    await page.goto(
      'http://localhost:3100/cart',
    );

    await expect(
      page.getByText(
        'Classic Cotton T-Shirt',
        {
          exact:
            false,
        },
      ).first(),
    ).toBeVisible();

    await expect(
      page.getByRole(
        'contentinfo',
      ),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByText(
        'Classic Cotton T-Shirt',
        {
          exact:
            false,
        },
      ).first(),
    ).toBeVisible();
  },
);
