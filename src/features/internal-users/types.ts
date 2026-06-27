export type InternalUserListItem = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  defaultCompanyId: string | null;
  roles: string[];
  createdAt: string;
  updatedAt: string;
};
