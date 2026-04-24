import { describe, it, expect, beforeEach } from "vitest";
import { useWorkoutStore } from "@/store/workoutStore";

// Reset store state between tests
beforeEach(() => {
  useWorkoutStore.setState({
    isDrawerOpen: false,
    drawerView: null,
    selectedWorkoutId: null,
    previewData: null,
  });
});

describe("workoutStore initial state", () => {
  it("isDrawerOpen is false", () => {
    expect(useWorkoutStore.getState().isDrawerOpen).toBe(false);
  });
  it("drawerView is null", () => {
    expect(useWorkoutStore.getState().drawerView).toBeNull();
  });
  it("selectedWorkoutId is null", () => {
    expect(useWorkoutStore.getState().selectedWorkoutId).toBeNull();
  });
  it("previewData is null", () => {
    expect(useWorkoutStore.getState().previewData).toBeNull();
  });
});

describe("openDrawer", () => {
  it("sets isDrawerOpen to true", () => {
    useWorkoutStore.getState().openDrawer();
    expect(useWorkoutStore.getState().isDrawerOpen).toBe(true);
  });
  it("sets drawerView to 'create' when no workoutId", () => {
    useWorkoutStore.getState().openDrawer();
    expect(useWorkoutStore.getState().drawerView).toBe("create");
  });
  it("sets drawerView to 'view' when workoutId provided", () => {
    useWorkoutStore.getState().openDrawer("workout-123");
    expect(useWorkoutStore.getState().drawerView).toBe("view");
  });
  it("sets selectedWorkoutId when provided", () => {
    useWorkoutStore.getState().openDrawer("workout-123");
    expect(useWorkoutStore.getState().selectedWorkoutId).toBe("workout-123");
  });
  it("selectedWorkoutId is null when not provided", () => {
    useWorkoutStore.getState().openDrawer();
    expect(useWorkoutStore.getState().selectedWorkoutId).toBeNull();
  });
});

describe("closeDrawer", () => {
  it("resets isDrawerOpen to false", () => {
    useWorkoutStore.getState().openDrawer("workout-123");
    useWorkoutStore.getState().closeDrawer();
    expect(useWorkoutStore.getState().isDrawerOpen).toBe(false);
  });
  it("resets drawerView to null", () => {
    useWorkoutStore.getState().openDrawer("workout-123");
    useWorkoutStore.getState().closeDrawer();
    expect(useWorkoutStore.getState().drawerView).toBeNull();
  });
  it("resets selectedWorkoutId to null", () => {
    useWorkoutStore.getState().openDrawer("workout-123");
    useWorkoutStore.getState().closeDrawer();
    expect(useWorkoutStore.getState().selectedWorkoutId).toBeNull();
  });
});

describe("setDrawerView", () => {
  it("changes drawerView", () => {
    useWorkoutStore.getState().openDrawer("workout-123");
    useWorkoutStore.getState().setDrawerView("edit");
    expect(useWorkoutStore.getState().drawerView).toBe("edit");
  });
  it("sets drawerView to view", () => {
    useWorkoutStore.getState().openDrawer("workout-123");
    useWorkoutStore.getState().setDrawerView("view");
    expect(useWorkoutStore.getState().drawerView).toBe("view");
  });
});

describe("workoutStore — local mutation event bus", () => {
  beforeEach(() => {
    // Reset store between tests
    useWorkoutStore.setState({
      localMutation: null,
      localMutationSeq: 0,
    });
  });

  it("emitLocalMutation sets the mutation and increments the sequence", () => {
    useWorkoutStore.getState().emitLocalMutation({ type: "remove", id: "w1" });
    const state = useWorkoutStore.getState();
    expect(state.localMutation).toEqual({ type: "remove", id: "w1" });
    expect(state.localMutationSeq).toBe(1);
  });

  it("emitting multiple mutations monotonically increments the sequence", () => {
    const store = useWorkoutStore.getState();
    store.emitLocalMutation({ type: "remove", id: "w1" });
    store.emitLocalMutation({
      type: "insert",
      workout: {
        id: "w2",
        date: "2026-04-23T00:00:00.000Z",
        dateFormatted: "Thu, Apr 23, 2026",
        durationMinutes: 0,
        notes: null,
        exerciseNames: [],
        totalSets: 0,
      },
    });
    const state = useWorkoutStore.getState();
    expect(state.localMutationSeq).toBe(2);
    expect(state.localMutation?.type).toBe("insert");
  });

  it("emits edit mutations with partial patches", () => {
    useWorkoutStore.getState().emitLocalMutation({
      type: "edit",
      id: "w1",
      patch: { isDraft: false },
    });
    const state = useWorkoutStore.getState();
    expect(state.localMutation).toEqual({
      type: "edit",
      id: "w1",
      patch: { isDraft: false },
    });
  });

  it("emits restore mutations with the full workout and after-id anchor", () => {
    const w = {
      id: "w1",
      date: "2026-04-23T00:00:00.000Z",
      dateFormatted: "Thu, Apr 23, 2026",
      durationMinutes: 0,
      notes: null,
      exerciseNames: [],
      totalSets: 0,
    };
    useWorkoutStore.getState().emitLocalMutation({
      type: "restore",
      workout: w,
      afterId: "w0",
    });
    expect(useWorkoutStore.getState().localMutation).toEqual({
      type: "restore",
      workout: w,
      afterId: "w0",
    });
  });
});
