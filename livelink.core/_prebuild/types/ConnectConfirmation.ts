import { UUID } from "../../sources/types/common";

export type ConnectConfirmation = {
  folder_id: UUID;
  scene_id: UUID;
  user_id: UUID;
  session_id: UUID;
};
