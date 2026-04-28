export type ToolType = "public" | "private";

export type HglTool = {
  id: string;
  name: string;
  url: string;
  description: string;
  updated_on: string;
  type: ToolType;
  logo_url: string | null;
  created_at: string;
};

export type HglMember = {
  email: string;
  created_at: string;
};
