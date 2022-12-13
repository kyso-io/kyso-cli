import { TeamVisibilityEnum } from '@kyso-io/kyso-model';

export interface ChannelData {
  organization: string;
  slug: string;
  visibility: TeamVisibilityEnum;
  display_name: string;
  description: string | null;
}
