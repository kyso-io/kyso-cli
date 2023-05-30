import type { TeamVisibilityEnum } from '@kyso-io/kyso-model';

export type ChannelData = {
  organization: string;
  slug: string;
  visibility: TeamVisibilityEnum;
  display_name: string;
  description: string | null;
};
