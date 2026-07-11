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

/** A single clean, full-width option row: a left radio dot (single-select) or
 *  checkbox (multi), then the label + optional muted description. Selected state
 *  uses this app's shadcn tokens (accent bg + primary ring). */
function OptionRow({
  label,
  description,
  multiple,
  picked,
  disabled,
  onClick,
}: {
  label: string;
  description?: string;
  multiple?: boolean;
  picked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={picked}
      data-picked={picked || undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        picked
          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
        disabled && "cursor-default",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center border transition-colors",
          multiple ? "rounded-[4px]" : "rounded-full",
          picked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
        )}
      >
        {picked &&
          (multiple ? (
            <CheckIcon className="size-3" />
          ) : (
            <span className="size-1.5 rounded-full bg-primary-foreground" />
          ))}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium leading-tight">{label}</span>
        {description && (
          <span className="text-xs leading-snug text-muted-foreground">{description}</span>
        )}
      </span>
    </button>
  );
}

/**
 * Interactive `question`-tool card (Phase 05). Renders the pending question(s)
 * as clean, full-width option ROWS (radio for single-select, checkbox when
 * `multiple`) plus an optional free-text "type your own" row (`custom`, default
 * true). A SINGLE question renders header + rows + Dismiss | Submit (no pager).
 * MULTIPLE questions render ONE at a time via `activeTab` with a clickable
 * progress row ("N of Total") and a Dismiss | Back | Next/Submit footer — Submit
 * still posts the FULL `answers: string[][]` matrix at once.
 *
 * On submit it resolves the interrupt with `answers: string[][]` (selected option
 * LABELS per question) + optional `text`, POSTed to the resume endpoint as
 * `action: "approved"`. "Dismiss" SKIPS the question LOCALLY (adds the
 * toolCallId to the ui-store's `skippedQuestions`) WITHOUT posting `denied` — the
 * backend run stays `awaiting-input` so the user can reopen and answer it later.
 *
 * `variant="composer"` styles the card as a floating dock in the composer slot
 * (replacing the chat input while a question is pending, ChatGPT-style); the
 * default variant renders inline in the transcript as read-only history.
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

    // One selection set per question (labels), plus one free-text box per
    // question, plus which question is currently shown in the pager.
    const [selected, setSelected] = useState<string[][]>(() =>
      questions.map(() => []),
    );
    const [texts, setTexts] = useState<string[]>(() => questions.map(() => ""));
    const [activeTab, setActiveTab] = useState(0);
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

    // A question is "answered" if it has a selection or non-empty custom text.
    const isAnswered = (qi: number) =>
      (selected[qi]?.length ?? 0) > 0 || Boolean(texts[qi]?.trim());
    // At least one answer (option or text) across all questions enables submit.
    const hasAnswer = questions.some((_, qi) => isAnswered(qi));

    const total = questions.length;
    const pager = !settled && total > 1;
    const lastTab = activeTab >= total - 1;

    // Cmd/Ctrl+Enter advances the pager, or submits on the last/only page.
    const advance = () => {
      if (pager && !lastTab) setActiveTab((t) => Math.min(total - 1, t + 1));
      else void submit();
    };

    const cardClass = cn(
      "flex w-full flex-col gap-4 rounded-xl border p-4",
      settled ? "bg-card" : "border-primary/40 bg-primary/5",
      variant === "composer" &&
        "rounded-[26px] border-border/70 bg-card/80 p-5 shadow-xl shadow-black/10 backdrop-blur-xl",
    );

    // ── Settled / inline history: read-only recap of ALL questions + chosen
    //    answers (paging only matters while answering).
    if (settled) {
      return (
        <div ref={cardRef} className={cardClass}>
          <div className="flex items-center gap-2 text-sm font-medium">
            <HelpCircleIcon className="size-4 text-primary" />
            Your answers
            {interrupt.resolved === "denied" && (
              <Badge variant="secondary" className="ml-auto gap-1 rounded-full text-xs">
                <XIcon className="size-3 text-destructive" /> Dismissed
              </Badge>
            )}
          </div>

          {questions.map((q, qi) => {
            const chosen = interrupt.answers?.[qi] ?? [];
            return (
              <div key={qi} className="flex flex-col gap-1.5">
                {q.header && (
                  <Badge
                    variant="secondary"
                    className="w-fit rounded-full text-[11px] font-medium"
                  >
                    {q.header}
                  </Badge>
                )}
                <p className="text-sm">{q.question}</p>
                {chosen.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {chosen.map((label) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="gap-1 rounded-md border-primary/30 bg-primary/10 text-xs font-normal"
                      >
                        <CheckIcon className="size-3 text-primary" />
                        {label}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No answer</p>
                )}
              </div>
            );
          })}

          {interrupt.answerText && (
            <p className="rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
              {interrupt.answerText}
            </p>
          )}
        </div>
      );
    }

    // ── Live form. Which questions to render: the whole stack for a single
    //    question, or just `activeTab` in the pager.
    const shown = pager ? [activeTab] : questions.map((_, i) => i);

    const renderQuestion = (qi: number) => {
      const q = questions[qi];
      const custom = q.custom ?? true;
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

          <div className="flex flex-col gap-1.5">
            {q.options.map((opt) => (
              <OptionRow
                key={opt.label}
                label={opt.label}
                description={opt.description}
                multiple={q.multiple}
                picked={selected[qi]?.includes(opt.label) ?? false}
                disabled={submitting}
                onClick={() => toggle(qi, opt.label, q.multiple)}
              />
            ))}

            {/* Free-text "type your own" custom row (last option). */}
            {custom && (
              <div
                data-picked={texts[qi]?.trim() ? true : undefined}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-colors",
                  texts[qi]?.trim()
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-border bg-card",
                )}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  Type your own answer
                </span>
                <Textarea
                  value={texts[qi] ?? ""}
                  onChange={(e) =>
                    setTexts((prev) => {
                      const next = prev.slice();
                      next[qi] = e.target.value;
                      return next;
                    })
                  }
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      advance();
                    }
                  }}
                  disabled={submitting}
                  rows={2}
                  placeholder="Or type your own answer…"
                  className="min-h-0 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div
        ref={cardRef}
        data-question-panel={variant === "composer" ? "" : undefined}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            advance();
          }
        }}
        className={cardClass}
      >
        {/* Header. In the pager it carries the progress row + "N of Total". */}
        <div className="flex items-center gap-2">
          <HelpCircleIcon className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {interrupt.prompt || (pager ? "A few questions" : questions[0].question)}
          </span>
          {pager && (
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-1.5">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Question ${i + 1}`}
                    data-active={i === activeTab || undefined}
                    data-answered={isAnswered(i) || undefined}
                    disabled={submitting}
                    onClick={() => setActiveTab(i)}
                    className="group flex h-4 w-5 items-center justify-center"
                  >
                    <span
                      className={cn(
                        "h-[3px] w-full rounded-full transition-colors",
                        i === activeTab
                          ? "bg-primary"
                          : isAnswered(i)
                            ? "bg-primary/50"
                            : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50",
                      )}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {activeTab + 1} of {total}
              </span>
            </div>
          )}
        </div>

        {shown.map((qi) => renderQuestion(qi))}

        {/* Footer: Dismiss | (Back) | Next/Submit for the pager, else
            Dismiss | Submit for a single question. */}
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={skip} disabled={submitting}>
            Dismiss
          </Button>
          <div className="flex items-center gap-2">
            {pager && activeTab > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveTab((t) => Math.max(0, t - 1))}
                disabled={submitting}
              >
                Back
              </Button>
            )}
            {pager && !lastTab ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveTab((t) => Math.min(total - 1, t + 1))}
                disabled={submitting}
              >
                Next
              </Button>
            ) : (
              <Button size="sm" onClick={submit} disabled={submitting || !hasAnswer}>
                <SendIcon className="size-4" /> Submit
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  },
  (a, b) =>
    a.interrupt.toolCallId === b.interrupt.toolCallId &&
    a.interrupt.resolved === b.interrupt.resolved &&
    a.interrupt.questions === b.interrupt.questions &&
    a.variant === b.variant,
);
