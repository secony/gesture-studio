
import { describe, expect, it } from "vitest";
import { ActionEngine } from "../../src/actions/ActionEngine";
import type { InteractionResult } from "../../src/interaction/InteractionTypes";

function createInteraction(
  action: InteractionResult["action"],
  handedness: InteractionResult["handedness"] = "Right"
): InteractionResult {
  return {
    action,
    handedness,
    sourceGesture: "OPEN_HAND",
  };
}

describe("ActionEngine", () => {
  it("deve iniciar no modo INACTIVE", () => {
    const engine = new ActionEngine();

    expect(engine.getMode()).toBe("INACTIVE");
  });

  it("deve ativar o modo de interação", () => {
    const engine = new ActionEngine();

    const result = engine.execute(
      createInteraction("ACTIVATE_MODE")
    );

    expect(result).toEqual({
      action: "ACTIVATE_MODE",
      status: "SIMULATED",
      mode: "ACTIVE",
      handedness: "Right",
      message: "Modo de interação ativado.",
    });

    expect(engine.getMode()).toBe("ACTIVE");
  });

  it("deve permitir seleção quando o modo está ativo", () => {
    const engine = new ActionEngine();

    engine.execute(createInteraction("ACTIVATE_MODE"));

    const result = engine.execute(
      createInteraction("SELECT")
    );

    expect(result.status).toBe("SIMULATED");
    expect(result.mode).toBe("ACTIVE");
    expect(result.message).toBe("Ação de seleção simulada.");
  });

  it("deve ignorar seleção quando o modo está inativo", () => {
    const engine = new ActionEngine();

    const result = engine.execute(
      createInteraction("SELECT")
    );

    expect(result.status).toBe("IGNORED");
    expect(result.mode).toBe("INACTIVE");
    expect(result.message).toBe(
      "Seleção ignorada: modo de interação inativo."
    );
  });

  it("deve desativar o modo de interação com CANCEL", () => {
    const engine = new ActionEngine();

    engine.execute(createInteraction("ACTIVATE_MODE"));

    const result = engine.execute(
      createInteraction("CANCEL")
    );

    expect(result.status).toBe("SIMULATED");
    expect(result.mode).toBe("INACTIVE");
    expect(result.message).toBe("Modo de interação desativado.");

    expect(engine.getMode()).toBe("INACTIVE");
  });

  it("deve ignorar NONE sem alterar o estado", () => {
    const engine = new ActionEngine();

    engine.execute(createInteraction("ACTIVATE_MODE"));

    const result = engine.execute(
      createInteraction("NONE")
    );

    expect(result.status).toBe("IGNORED");
    expect(result.mode).toBe("ACTIVE");
    expect(result.message).toBe("Nenhuma ação executada.");

    expect(engine.getMode()).toBe("ACTIVE");
  });

  it("deve preservar a identificação da mão que originou a ação", () => {
    const engine = new ActionEngine();

    const result = engine.execute(
      createInteraction("ACTIVATE_MODE", "Left")
    );

    expect(result.handedness).toBe("Left");
  });

  it("deve manter o estado correto durante uma sequência de ações", () => {
    const engine = new ActionEngine();

    const activation = engine.execute(
      createInteraction("ACTIVATE_MODE")
    );

    const selection = engine.execute(
      createInteraction("SELECT")
    );

    const cancellation = engine.execute(
      createInteraction("CANCEL")
    );

    const ignoredSelection = engine.execute(
      createInteraction("SELECT")
    );

    expect(activation.mode).toBe("ACTIVE");
    expect(selection.status).toBe("SIMULATED");
    expect(cancellation.mode).toBe("INACTIVE");
    expect(ignoredSelection.status).toBe("IGNORED");
    expect(engine.getMode()).toBe("INACTIVE");
  });
});
