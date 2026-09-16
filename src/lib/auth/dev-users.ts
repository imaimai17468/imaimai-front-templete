export interface DevUser {
  email: string;
  name: string;
  password: string;
}

export const DEV_USER: DevUser = {
  email: "dev@example.com",
  name: "Dev User",
  password: "dev-password",
};
