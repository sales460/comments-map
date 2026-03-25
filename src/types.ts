export interface UserNode {
  id: string;
  name: string;
  avatar: string;
  role: string;
  bio: string;
}

export interface UserLink {
  source: string;
  target: string;
  isStrong: boolean;
}

export interface SocialGraph {
  nodes: UserNode[];
  links: UserLink[];
}
