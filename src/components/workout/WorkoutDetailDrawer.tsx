"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer } from "@/components/ui/Drawer";
import { WorkoutForm } from "@/components/workout/WorkoutForm";
import { WorkoutSummaryView } from "@/components/workout/WorkoutSummaryView";
import { WorkoutViewDetail } from "@/components/workout/WorkoutViewDetail";
import { useWorkoutStore } from "@/store/workoutStore";
import { useWorkoutDetail } from "@/components/workout/hooks/useWorkoutDetail";
import { formatDate, fadeSlide } from "@/lib/utils";
import type { SessionSummaryData } from "@/types/workout";

export function WorkoutDetailDrawer() {
  const {
    isDrawerOpen,
    drawerView,
    selectedWorkoutId,
    previewData,
    activeSession,
    closeDrawer,
    setDrawerView,
  } = useWorkoutStore();
  const router = useRouter();

  const { workout, setWorkout, loading } = useWorkoutDetail(isDrawerOpen, selectedWorkoutId);

  function handleCreateSave(data: SessionSummaryData) {
    setDrawerView("summary", data);
    router.refresh();
  }

  function handleEditSave(data: SessionSummaryData) {
    setWorkout({
      id: data.id,
      date: data.date,
      duration_minutes: data.duration_minutes,
      notes: data.notes,
      workout_exercises: data.workout_exercises.map((we, i) => ({
        ...we,
        order: i,
      })),
    });
    setDrawerView("view");
    router.refresh();
  }

  function handleViewDetails() {
    if (!activeSession) return;
    setWorkout({
      id: activeSession.id,
      date: activeSession.date,
      duration_minutes: activeSession.duration_minutes,
      notes: activeSession.notes,
      workout_exercises: activeSession.workout_exercises.map((we, i) => ({
        ...we,
        order: i,
      })),
    });
    useWorkoutStore.setState({ selectedWorkoutId: activeSession.id });
    setDrawerView("view");
  }

  const drawerTitle =
    drawerView === "create" ? "Log Workout"
    : drawerView === "summary" ? "Workout Logged"
    : drawerView === "edit" ? "Edit Workout"
    : workout ? formatDate(workout.date)
    : previewData ? previewData.dateFormatted
    : loading ? " "
    : undefined;

  // Freeze the title during close animation — closeDrawer() resets drawerView
  // immediately, which would drop the title to undefined and collapse the header
  // before the drawer finishes sliding out.
  const frozenTitle = useRef<string | undefined>(undefined);
  if (drawerTitle !== undefined) frozenTitle.current = drawerTitle;
  const effectiveTitle = isDrawerOpen ? drawerTitle : frozenTitle.current;

  const initialData = workout
    ? {
        date: workout.date.split("T")[0],
        notes: workout.notes,
        duration_minutes: workout.duration_minutes,
        exercises: workout.workout_exercises.map((we) => ({
          exercise_id: we.exercise.id,
          exercise_name: we.exercise.name,
          muscle_groups: we.exercise.muscle_groups,
          equipment: we.exercise.equipment,
          order: we.order,
          sets: we.sets.map((s) => ({
            set_number: s.set_number,
            reps: s.reps,
            weight: s.weight,
          })),
        })),
      }
    : undefined;

  return (
    <Drawer open={isDrawerOpen} onClose={closeDrawer} title={effectiveTitle}>
      <div className="px-5 py-5">
        <AnimatePresence mode="wait" initial={false}>

          {/* ── Create ── */}
          {drawerView === "create" && (
            <motion.div key="create" {...fadeSlide}>
              <WorkoutForm
                compact
                onSave={handleCreateSave}
                onCancel={closeDrawer}
              />
            </motion.div>
          )}

          {/* ── Summary ── */}
          {drawerView === "summary" && activeSession && (
            <motion.div key="summary" {...fadeSlide}>
              <WorkoutSummaryView
                session={activeSession}
                onDone={closeDrawer}
                onViewDetails={handleViewDetails}
              />
            </motion.div>
          )}

          {/* ── View ── */}
          {drawerView === "view" && (
            <motion.div key="view" {...fadeSlide}>
              <WorkoutViewDetail
                workout={workout}
                loading={loading}
                previewData={previewData}
                onEdit={() => setDrawerView("edit")}
                onDelete={() => {
                  closeDrawer();
                  router.refresh();
                }}
              />
            </motion.div>
          )}

          {/* ── Edit ── */}
          {drawerView === "edit" && workout && (
            <motion.div key="edit" {...fadeSlide}>
              <WorkoutForm
                compact
                workoutId={workout.id}
                initialData={initialData}
                onSave={handleEditSave}
                onCancel={() => setDrawerView("view")}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </Drawer>
  );
}
