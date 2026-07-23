"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CalendarAppointment } from "@/components/calendar/types";
import { deleteAppointmentPermanentlyAction } from "@/app/actions/beta-delete";

type DeleteAppointmentDialogProps = {
  open: boolean;
  appointment: CalendarAppointment | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export default function DeleteAppointmentDialog({
  open,
  appointment,
  onOpenChange,
  onDeleted,
}: DeleteAppointmentDialogProps) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  function handleOpenChange(nextOpen: boolean) {
    if (isDeleting) {
      return;
    }

    setErrorMessage(null);
    onOpenChange(nextOpen);
  }

  async function handleDelete() {
    if (!appointment) {
      return;
    }

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      await deleteAppointmentPermanentlyAction(appointment.id);

      onOpenChange(false);
      onDeleted?.();
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete the appointment.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete appointment?</DialogTitle>

          <DialogDescription>
            This will permanently delete{" "}
            <span className="font-medium text-gray-900">
              {appointment?.title || "this appointment"}
            </span>
            , including its scheduling record. This permanent beta cleanup action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        ) : null}

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || !appointment}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {isDeleting ? "Deleting..." : "Delete appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
