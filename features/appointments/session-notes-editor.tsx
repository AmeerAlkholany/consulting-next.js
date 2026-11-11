"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Save, Trash2, Edit3, Shield } from "lucide-react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { upsertAppointmentNoteAction, deleteAppointmentNoteAction } from "./consultant-actions";

export interface SerializedNote {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionNotesEditorProps {
  appointmentId: string;
  initialNotes: SerializedNote[];
}

export function SessionNotesEditor({ appointmentId, initialNotes }: SessionNotesEditorProps) {
  const [notes, setNotes] = useState<SerializedNote[]>(initialNotes);
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreateNote = () => {
    if (!newBody.trim()) return;
    setError(null);

    startTransition(async () => {
      const res = await upsertAppointmentNoteAction({
        appointmentId,
        body: newBody.trim(),
      });

      if (!res.success) {
        setError(res.message || "Failed to create note");
        return;
      }

      const note = res.data as { id: string; body: string; createdAt: Date; updatedAt: Date };
      setNotes((prev) => [
        {
          id: note.id,
          body: note.body,
          createdAt: new Date(note.createdAt).toISOString(),
          updatedAt: new Date(note.updatedAt).toISOString(),
        },
        ...prev,
      ]);
      setNewBody("");
    });
  };

  const handleUpdateNote = (noteId: string) => {
    if (!editBody.trim()) return;
    setError(null);

    startTransition(async () => {
      const res = await upsertAppointmentNoteAction({
        appointmentId,
        noteId,
        body: editBody.trim(),
      });

      if (!res.success) {
        setError(res.message || "Failed to update note");
        return;
      }

      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, body: editBody.trim() } : n)));
      setEditingId(null);
      setEditBody("");
    });
  };

  const handleDeleteNote = (noteId: string) => {
    setError(null);

    startTransition(async () => {
      const res = await deleteAppointmentNoteAction(appointmentId, noteId);
      if (!res.success) {
        setError(res.message || "Failed to delete note");
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" />
              Private Clinical Notes
            </CardTitle>
            <CardDescription className="text-xs">
              Encrypted at rest with AES-256-GCM. Visible strictly to you (never shown to client or
              platform admins).
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            End-to-End Encrypted
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">{error}</div>
        )}

        <div className="space-y-2">
          <Textarea
            placeholder="Write private clinical observation, treatment notes, or follow-up items..."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={3}
            disabled={isPending}
            className="resize-y"
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>{newBody.length}/5000 characters</span>
            <Button
              size="sm"
              onClick={handleCreateNote}
              disabled={isPending || !newBody.trim()}
              className="gap-1"
            >
              <Save className="h-3.5 w-3.5" />
              {isPending ? "Encrypting..." : "Save Note"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              No private notes recorded yet for this appointment.
            </p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="p-3.5 rounded-lg border bg-card/50 text-sm space-y-2">
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      disabled={isPending}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateNote(note.id)}
                        disabled={isPending || !editBody.trim()}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                      {note.body}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                      <span>{new Date(note.createdAt).toLocaleString()}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setEditingId(note.id);
                            setEditBody(note.body);
                          }}
                          disabled={isPending}
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <ConfirmDialog
                          title="Delete clinical note?"
                          description="This private note will be permanently erased from the database. This action cannot be undone."
                          confirmLabel="Delete Note"
                          tone="destructive"
                          onConfirm={() => handleDeleteNote(note.id)}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                              disabled={isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Delete
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
