"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import type { ChatMessage, Question, ToolPart } from "@/lib/chat/types";
import { CheckIcon, HelpCircleIcon, XIcon } from "lucide-react";
import { memo, useEffect, useRef } from "react";

/** The answers to a `question` call: one list of labels (or typed text) per
 *  question, empty for one skipped, and `skipped` when every one was. */
export type QuestionAnswers = { answers: string[][]; skipped?: boolean };

export type Answer = (interruptId: string, output: QuestionAnswers) => void;

/** The questions a `question` call asks: its input, or while it waits for
 *  the user, its request's arguments. */
export function questionsOf(part: ToolPart): Question[] {
  const args = part.state === "approval" ? part.request?.args : part.input;
  return (args as { questions?: Question[] } | undefined)?.questions ?? [];
}

/** The `question` call a thread's run waits on, if any. */
export function pendingQuestion(messages: ChatMessage[]): ToolPart | undefined {
  return messages
    .at(-1)
    ?.parts.find(
      (p): p is ToolPart =>
        p.type === "tool" && p.state === "approval" && (p.toolName === "question" || p.request?.toolName === "question"),
    );
}

/**
 * The questions a run waits on, one at a time: each with its options (number
 * keys pick them) and a box for another answer; Skip passes one by. Skip all
 * answers none of them, and the agent goes on without. Cancel, when given,
 * puts the panel away unanswered.
 */
export function QuestionPanel({ part, onAnswer, onCancel }: { part: ToolPart; onAnswer: Answer; onCancel?: () => void }) {
  const questions = questionsOf(part);
  const id = part.approval?.id ?? part.toolCallId;
  // Focus the question shown, so its number keys work at once: a frame
  // later, once the questionnaire has chosen it.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      ref.current?.querySelector<HTMLElement>("[data-slot=questionnaire-item]:not([hidden])")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={ref} className="rounded-2xl bg-muted p-4">
      <Questionnaire
        shortcuts="numbers"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const answers = questions.map((_, i) =>
            form
              .getAll(`q${i}`)
              .map((v) => String(v).trim())
              .filter(Boolean),
          );
          onAnswer(id, { answers, skipped: answers.every((a) => a.length === 0) || undefined });
        }}
      >
        <div className="flex items-center gap-2">
          <HelpCircleIcon className="size-4 text-primary" />
          <QuestionnaireProgress className="mr-auto" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAnswer(id, { answers: questions.map(() => []), skipped: true })}
          >
            Skip all
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} title="Answer later" aria-label="Answer later">
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
        {questions.map((q, i) => (
          <QuestionnaireItem key={i} name={`q${i}`} multiple={q.multiple}>
            <QuestionnaireTitle>{q.question}</QuestionnaireTitle>
            {q.header && <QuestionnaireDescription>{q.header}</QuestionnaireDescription>}
            <QuestionnaireChoices>
              {q.options.map((o) => (
                <QuestionnaireChoice key={o.label} value={o.label}>
                  {o.label}
                  {o.description && <QuestionnaireChoiceDescription>{o.description}</QuestionnaireChoiceDescription>}
                </QuestionnaireChoice>
              ))}
              <QuestionnaireInput placeholder="Something else…" aria-label="Another answer" />
            </QuestionnaireChoices>
          </QuestionnaireItem>
        ))}
        <QuestionnaireActions>
          <QuestionnairePrevious size="sm" variant="ghost" />
          <QuestionnaireSkip size="sm" variant="ghost" />
          <QuestionnaireNext size="sm" />
          <QuestionnaireSubmit size="sm" />
        </QuestionnaireActions>
      </Questionnaire>
    </div>
  );
}

/**
 * A `question` call in the thread: while it waits, a line with a button that
 * brings the questions back in place of the composer; once answered, the
 * questions and the answers given.
 */
export const QuestionCard = memo(function QuestionCard({ part, onReopen }: { part: ToolPart; onReopen?: () => void }) {
  const questions = questionsOf(part);
  if (questions.length === 0) return null;
  if (part.state === "approval") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
        <HelpCircleIcon className="size-4 text-muted-foreground" />
        <span className="mr-auto">{questions.length === 1 ? "A question is waiting for you" : `${questions.length} questions are waiting for you`}</span>
        {onReopen && (
          <Button size="sm" onClick={onReopen}>
            Answer
          </Button>
        )}
      </div>
    );
  }
  if (part.state !== "done") {
    return (
      <div className="flex items-center gap-2 px-1.5 py-1 text-xs text-muted-foreground">
        <HelpCircleIcon className="size-3.5" /> Questions not answered
      </div>
    );
  }
  const output = part.state === "done" ? (part.output as QuestionAnswers | undefined) : undefined;
  return (
    <div className="flex w-full flex-col gap-4 rounded-xl bg-muted p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <HelpCircleIcon className="size-4 text-primary" />
        {output?.skipped ? "Questions skipped" : "Your answers"}
      </div>
      {!output?.skipped &&
        questions.map((q, qi) => {
          const chosen = output?.answers?.[qi] ?? [];
          return (
            <div key={qi} className="flex flex-col gap-1.5">
              <p className="text-sm">{q.question}</p>
              {chosen.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {chosen.map((label) => (
                    <Badge key={label} className="gap-1 rounded-md bg-background text-xs font-normal text-foreground">
                      <CheckIcon className="size-3 text-primary" />
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Skipped</p>
              )}
            </div>
          );
        })}
    </div>
  );
});
