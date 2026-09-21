export const CUSTOMER_TOKEN_KEY =
  'sgcommerce-customer-token';

export function getCustomerToken() {
  if (
    typeof window ===
    'undefined'
  ) {
    return null;
  }

  return window.localStorage
    .getItem(
      CUSTOMER_TOKEN_KEY,
    );
}

export function setCustomerToken(
  token: string,
) {
  window.localStorage.setItem(
    CUSTOMER_TOKEN_KEY,
    token,
  );
}

export function clearCustomerToken() {
  window.localStorage.removeItem(
    CUSTOMER_TOKEN_KEY,
  );
}
