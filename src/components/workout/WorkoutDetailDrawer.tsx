"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer } from "@/components/ui/Drawer";
import { WorkoutForm } from "@/components/workout/WorkoutForm";
import { WorkoutViewDetail } from "@/components/workout/WorkoutViewDetail";
import { useWorkoutStore } from "@/store/workoutStore";
import { useWorkoutDetail } from "@/components/workout/hooks/useWorkoutDetail";
import { formatDate, fadeSlide } from "@/lib/utils";
import type { WorkoutSaveData } from "@/types/workout";

export function WorkoutDetailDrawer() {
  const {
    isDrawerOpen,
    drawerView,
    selectedWorkoutId,
    previewData,
    closeDrawer,
    setDrawerView,
  } = useWorkoutStore();

  const { workout, setWorkout, loading } = useWorkoutDetail(isDrawerOpen, selectedWorkoutId);

  // Form handles its own toast + optimistic list/SWR updates. Drawer just closes.
  function handleCreateSave() {
    closeDrawer();
  }

  function handleEditSave(data: WorkoutSaveData) {
    // Keep drawer-local state in sync so view mode renders immediately without waiting
    // for SWR revalidation. Toast and cache invalidation happen in the form.
    setWorkout({
      id: data.id,
      date: data.date,
      duration_minutes: data.duration_minutes,
      notes: data.notes,
      body_weight: data.body_weight,
      is_draft: workout?.is_draft,
      workout_exercises: data.workout_exercises.map((we, i) => ({
        ...we,
        order: i,
      })),
    });
    setDrawerView("view");
  }

  const drawerTitle =
    drawerView === "create" ? "Log Workout"
    : drawerView === "edit" ? "Edit Workout"
    : workout ? formatDate(workout.date)
    : previewData ? previewData.dateFormatted
    : loading ? " "
    : undefined;

  // Freeze the title during close animation — closeDrawer() resets drawerView
  // immediately, which would drop the title to undefined and collapse the header
  // before the drawer finishes sliding out.
  const [frozenTitle, setFrozenTitle] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (drawerTitle !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cache last known title for close animation
      setFrozenTitle(drawerTitle);
    }
  }, [drawerTitle]);
  const effectiveTitle = isDrawerOpen ? drawerTitle : frozenTitle;

  const initialData = workout
    ? {
        date: workout.date.split("T")[0],
        notes: workout.notes,
        duration_minutes: workout.duration_minutes,
        body_weight: workout.body_weight,
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
                onDraftSave={closeDrawer}
                onCancel={closeDrawer}
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
                onDelete={closeDrawer}
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
