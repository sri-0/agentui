"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatDataParts, Question } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { CheckIcon, HelpCircleIcon, SendIcon, XIcon } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

import { useResolveInterrupt } from "../interrupt-context";

type Interrupt = ChatDataParts["tool-interrupt"];

/** Read the structured questions off an interrupt, whether the backend put them
 *  on `data.questions` or nested inside `data.details.questions`. */
export function extractQuestions(interrupt: Interrupt): Question[] | null {
  if (Array.isArray(interrupt.questions) && interrupt.questions.length > 0) {
    return interrupt.questions;
  }
  const details = interrupt.details as { questions?: unknown } | undefined;
  if (details && Array.isArray(details.questions) && details.questions.length) {
    return details.questions as Question[];
  }
  return null;
}

/** True when this interrupt should render as the interactive question form. */
export function isQuestionInterrupt(interrupt: Interrupt): boolean {
  return interrupt.toolName === "question" || extractQuestions(interrupt) != null;
}

/**
 * Interactive `question`-tool card (Phase 05). Instead of the generic
 * approve/deny card, it renders each question's options as selectable chips
 * (single-select by default, multi-select when `multiple`) plus an optional
 * free-text box (`custom`, default true). On submit it resolves the interrupt
 * with `answers: string[][]` (selected option LABELS per question) + optional
 * `text`, POSTed to the resume endpoint as `action: "approved"`. "Dismiss"
 * SKIPS the question LOCALLY (adds the toolCallId to the ui-store's
 * `skippedQuestions`) WITHOUT posting `denied` — the backend run stays
 * `awaiting-input` so the user can reopen and answer it later.
 *
 * `variant="composer"` styles the card to sit in the composer slot (replacing
 * the chat input while a question is pending, ChatGPT-style); the default
 * variant renders inline in the transcript as history.
 */
export const QuestionCard = memo(
  function QuestionCard({
    interrupt,
    variant = "inline",
  }: {
    interrupt: Interrupt;
    variant?: "inline" | "composer";
  }) {
    const resolveInterrupt = useResolveInterrupt();
    const skipQuestion = useUiStore((s) => s.skipQuestion);
    const questions = extractQuestions(interrupt) ?? [];
    const settled = Boolean(interrupt.resolved);

    // One selection set per question (labels), plus one free-text box per question.
    const [selected, setSelected] = useState<string[][]>(() =>
      questions.map(() => []),
    );
    const [texts, setTexts] = useState<string[]>(() => questions.map(() => ""));
    const [submitting, setSubmitting] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // A fresh question can render below the fold — bring it into view.
    useEffect(() => {
      if (settled) return;
      const id = requestAnimationFrame(() =>
        cardRef.current?.scrollIntoView({ block: "nearest" }),
      );
      return () => cancelAnimationFrame(id);
    }, [settled]);

    if (questions.length === 0) return null;

    const toggle = (qi: number, label: string, multiple?: boolean) => {
      setSelected((prev) => {
        const next = prev.map((s) => s.slice());
        const cur = next[qi];
        if (multiple) {
          const at = cur.indexOf(label);
          if (at === -1) cur.push(label);
          else cur.splice(at, 1);
        } else {
          next[qi] = cur[0] === label ? [] : [label];
        }
        return next;
      });
    };

    const submit = async () => {
      if (!resolveInterrupt || submitting) return;
      setSubmitting(true);
      try {
        // Fold each question's free text into its answer list so a custom answer
        // is preserved even when no option is picked. Backend takes labels.
        const answers = selected.map((labels, qi) => {
          const t = texts[qi]?.trim();
          return t ? [...labels, t] : labels;
        });
        await resolveInterrupt(interrupt.toolCallId, "approved", {
          answers,
          // Also surface a single joined free-text for backends that read `text`.
          text: texts.map((t) => t.trim()).filter(Boolean).join("\n") || undefined,
        });
      } finally {
        setSubmitting(false);
      }
    };

    // "Dismiss" = LOCAL skip: hide the panel (composer returns) but leave the
    // backend awaiting-input so it can be reopened and answered. No `denied`.
    const skip = () => skipQuestion(interrupt.toolCallId);

    // At least one answer (option or text) across all questions enables submit.
    const hasAnswer = selected.some((s) => s.length > 0) || texts.some((t) => t.trim());

    return (
      <div
        ref={cardRef}
        data-question-panel={variant === "composer" ? "" : undefined}
        className={cn(
          "flex w-full flex-col gap-4 rounded-xl border p-4",
          settled ? "bg-card" : "border-primary/40 bg-primary/5",
          variant === "composer" &&
            "rounded-[26px] border-border/70 bg-card/80 p-5 shadow-xl shadow-black/10 backdrop-blur-xl",
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <HelpCircleIcon className="size-4 text-primary" />
          {settled ? "Your answers" : interrupt.prompt || "A few questions"}
          {interrupt.resolved === "denied" && (
            <Badge variant="secondary" className="ml-auto gap-1 rounded-full text-xs">
              <XIcon className="size-3 text-destructive" /> Dismissed
            </Badge>
          )}
        </div>

        {questions.map((q, qi) => {
          const custom = q.custom ?? true;
          const chosen =
            interrupt.answers?.[qi] ?? selected[qi] ?? [];
          return (
            <div key={qi} className="flex flex-col gap-2">
              {q.header && (
                <Badge
                  variant="secondary"
                  className="w-fit rounded-full text-[11px] font-medium"
                >
                  {q.header}
                </Badge>
              )}
              <p className="text-sm">{q.question}</p>

              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const active = settled
                    ? chosen.includes(opt.label)
                    : selected[qi]?.includes(opt.label);
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={settled || submitting}
                      title={opt.description}
                      onClick={() => toggle(qi, opt.label, q.multiple)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-left text-sm transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:border-primary/40 hover:bg-accent/40",
                        (settled || submitting) && "cursor-default opacity-90",
                      )}
                    >
                      {active && <CheckIcon className="size-3.5" />}
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Free-text answer. When settled, show the typed text (if any). */}
              {custom && !settled && (
                <Textarea
                  value={texts[qi] ?? ""}
                  onChange={(e) =>
                    setTexts((prev) => {
                      const next = prev.slice();
                      next[qi] = e.target.value;
                      return next;
                    })
                  }
                  disabled={submitting}
                  rows={2}
                  placeholder="Or type your own answer…"
                  className="text-sm"
                />
              )}
              {settled &&
                interrupt.answerText &&
                qi === questions.length - 1 && (
                  <p className="rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                    {interrupt.answerText}
                  </p>
                )}
              {settled && chosen.length === 0 && !interrupt.answerText && (
                <p className="text-xs text-muted-foreground">No answer</p>
              )}
            </div>
          );
        })}

        {!settled && (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={skip}
              disabled={submitting}
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={submitting || !hasAnswer}
            >
              <SendIcon className="size-4" /> Submit
            </Button>
          </div>
        )}
      </div>
    );
  },
  (a, b) =>
    a.interrupt.toolCallId === b.interrupt.toolCallId &&
    a.interrupt.resolved === b.interrupt.resolved &&
    a.interrupt.questions === b.interrupt.questions &&
    a.variant === b.variant,
);
