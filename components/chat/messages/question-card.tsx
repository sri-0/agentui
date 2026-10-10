"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Question, ToolPart } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { CheckIcon, HelpCircleIcon, SendIcon } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

export type Answer = (
  toolCallId: string,
  output: { answers: string[][]; text?: string },
) => void;

/** A single clean, full-width option row: a left radio dot (single-select) or
 *  checkbox (multi), then the label + optional muted description. */
function OptionRow({
  label,
  description,
  multiple,
  picked,
  onClick,
}: {
  label: string;
  description?: string;
  multiple?: boolean;
  picked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={picked}
      data-picked={picked || undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        picked
          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center border transition-colors",
          multiple ? "rounded-[4px]" : "rounded-full",
          picked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40",
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
          <span className="text-xs leading-snug text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * The `question` tool's call, rendered as a form while the run waits for the
 * answer (`pending`) and as a read-only recap afterwards. The questions are
 * the call's input; the answers are its output once the run resumes. A single
 * question renders header + rows + Submit; several render one at a time with
 * a progress row and Back / Next, and Submit posts the full `answers` matrix.
 */
export const QuestionCard = memo(function QuestionCard({
  part,
  pending,
  onAnswer,
}: {
  part: ToolPart;
  pending: boolean;
  onAnswer: Answer;
}) {
  const questions =
    (part.input as { questions?: Question[] } | undefined)?.questions ?? [];
  const output =
    part.state === "done"
      ? (part.output as { answers?: string[][]; text?: string } | undefined)
      : undefined;

  // One selection set per question (labels), plus one free-text box per
  // question, plus which question is currently shown in the pager.
  const [selected, setSelected] = useState<string[][]>(() =>
    questions.map(() => []),
  );
  const [texts, setTexts] = useState<string[]>(() => questions.map(() => ""));
  const [activeTab, setActiveTab] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // A fresh question can render below the fold — bring it into view.
  useEffect(() => {
    if (!pending) return;
    const id = requestAnimationFrame(() =>
      cardRef.current?.scrollIntoView({ block: "nearest" }),
    );
    return () => cancelAnimationFrame(id);
  }, [pending]);

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

  const submit = () => {
    // Fold each question's free text into its answer list so a typed answer
    // is kept even when no option is picked.
    const answers = selected.map((labels, qi) => {
      const t = texts[qi]?.trim();
      return t ? [...labels, t] : labels;
    });
    onAnswer(part.toolCallId, {
      answers,
      text: texts.map((t) => t.trim()).filter(Boolean).join("\n") || undefined,
    });
  };

  const isAnswered = (qi: number) =>
    (selected[qi]?.length ?? 0) > 0 || Boolean(texts[qi]?.trim());
  const hasAnswer = questions.some((_, qi) => isAnswered(qi));
  const total = questions.length;
  const pager = total > 1;
  const lastTab = activeTab >= total - 1;

  // Cmd/Ctrl+Enter advances the pager, or submits on the last/only page.
  const advance = () => {
    if (pager && !lastTab) setActiveTab((t) => Math.min(total - 1, t + 1));
    else if (hasAnswer) submit();
  };

  // ── Settled: read-only recap of all questions and the chosen answers. The
  //    answers come back as the tool's output; until then (or if the run was
  //    cancelled) the local selection stands in.
  if (!pending) {
    const answers = output?.answers ?? selected;
    return (
      <div ref={cardRef} className="flex w-full flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HelpCircleIcon className="size-4 text-primary" />
          Your answers
        </div>
        {questions.map((q, qi) => {
          const chosen = answers[qi] ?? [];
          return (
            <div key={qi} className="flex flex-col gap-1.5">
              {q.header && (
                <Badge variant="secondary" className="w-fit rounded-full text-[11px] font-medium">
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
        {output?.text && (
          <p className="rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
            {output.text}
          </p>
        )}
      </div>
    );
  }

  // ── Live form: the whole stack for a single question, or just `activeTab`.
  const shown = pager ? [activeTab] : questions.map((_, i) => i);

  const renderQuestion = (qi: number) => {
    const q = questions[qi];
    return (
      <div key={qi} className="flex flex-col gap-2">
        {q.header && (
          <Badge variant="secondary" className="w-fit rounded-full text-[11px] font-medium">
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
              onClick={() => toggle(qi, opt.label, q.multiple)}
            />
          ))}

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
              rows={2}
              placeholder="Or type your own answer…"
              className="min-h-0 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={cardRef}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          advance();
        }
      }}
      className="flex w-full flex-col gap-4 rounded-xl border border-primary/40 bg-primary/5 p-4"
    >
      <div className="flex items-center gap-2">
        <HelpCircleIcon className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {pager ? "A few questions" : questions[0].question}
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

      <div className="flex items-center justify-end gap-2">
        {pager && activeTab > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActiveTab((t) => Math.max(0, t - 1))}
          >
            Back
          </Button>
        )}
        {pager && !lastTab ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActiveTab((t) => Math.min(total - 1, t + 1))}
          >
            Next
          </Button>
        ) : (
          <Button size="sm" onClick={submit} disabled={!hasAnswer}>
            <SendIcon className="size-4" /> Submit
          </Button>
        )}
      </div>
    </div>
  );
});
