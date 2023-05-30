export type OrganizationData = {
  slug: string;
  display_name: string;
  allowed_access_domains: string[];
  location: string | null;
  link: string | null;
  bio: string | null;
  channels: string[];
  photo?: string | null;
  options: {
    // DEPRECATED
    /* auth: {
      otherProviders: any[];
    }; */
    notifications: {
      centralized: boolean;
      emails: string[];
    };
  };
};
