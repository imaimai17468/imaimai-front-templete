/**
 * The persistence and object-storage operations the user gateway needs.
 *
 * The gateway is written against these rather than against a Drizzle handle or
 * an R2 bucket, so a caller supplies whichever implementation it has and a test
 * supplies a fake without standing up either service.
 */

interface UserProfileRow {
  id: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStore {
  findProfile: (userId: string) => Promise<UserProfileRow | null>;
  findAvatarUrl: (
    userId: string
  ) => Promise<{ avatarUrl: string | null } | null>;
  updateName: (userId: string, name: string | null) => Promise<void>;
  /** Number of rows the update touched, so the caller can reject a miss. */
  setAvatarUrl: (userId: string, avatarUrl: string) => Promise<number>;
}

export interface AvatarStorage {
  upload: (
    key: string,
    file: File | ArrayBuffer,
    contentType: string
  ) => Promise<string>;
  remove: (key: string) => Promise<void>;
}

export interface UserGatewayDeps {
  store: UserStore;
  storage: AvatarStorage;
  /** Injected so a test fixes the generated avatar key. */
  newId: () => string;
}
