
import type { InteractionResult } from "../interaction/InteractionTypes";

export type ActionStatus = "SIMULATED" | "IGNORED";

export type InteractionMode = "ACTIVE" | "INACTIVE";

export interface ActionExecutionResult {
  action: InteractionResult["action"];
  status: ActionStatus;
  mode: InteractionMode;
  handedness: InteractionResult["handedness"];
  message: string;
}

export class ActionEngine {
  private mode: InteractionMode = "INACTIVE";

  execute(interaction: InteractionResult): ActionExecutionResult {
    let status: ActionStatus = "SIMULATED";
    let message = "";

    switch (interaction.action) {
      case "ACTIVATE_MODE":
        this.mode = "ACTIVE";
        message = "Modo de interação ativado.";
        break;

      case "SELECT":
        if (this.mode === "ACTIVE") {
          message = "Ação de seleção simulada.";
        } else {
          status = "IGNORED";
          message = "Seleção ignorada: modo de interação inativo.";
        }
        break;

      case "CANCEL":
        this.mode = "INACTIVE";
        message = "Modo de interação desativado.";
        break;

      case "NONE":
        status = "IGNORED";
        message = "Nenhuma ação executada.";
        break;
    }

    return {
      action: interaction.action,
      status,
      mode: this.mode,
      handedness: interaction.handedness,
      message,
    };
  }

  getMode(): InteractionMode {
    return this.mode;
  }
}
