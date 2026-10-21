import React, { useState } from 'react';
import { HelpCircle, CheckCircle2, XCircle, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';
import type { ClinicalScenario, ScenarioPhase } from '../simulator/types';

interface Props {
  scenario: ClinicalScenario;
  currentPhase: ScenarioPhase;
  onAdvancePhase: () => void;
  hasNextPhase: boolean;
  onSelectOption?: (optionId: string, isCorrect: boolean) => void;
}

export const OsceQuestionPanel: React.FC<Props> = ({
  scenario,
  currentPhase,
  onAdvancePhase,
  hasNextPhase,
  onSelectOption,
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const question = currentPhase.question;
  const selectedOption = question.options.find((opt) => opt.id === selectedOptionId);

  const handleChoose = (optId: string) => {
    setSelectedOptionId(optId);
    setShowExplanation(true);
    const chosen = question.options.find((opt) => opt.id === optId);
    if (chosen && onSelectOption) {
      onSelectOption(optId, chosen.isCorrect);
    }
  };

  return (
    <div className="bg-slate-900 border-2 border-slate-700/80 rounded-2xl shadow-xl overflow-hidden flex flex-col font-sans">
      {/* Header with Case Title & Stage */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wide">
              Estação OSCE Prática
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {currentPhase.phaseName}
            </span>
          </div>
          <h2 className="text-sm md:text-base font-bold text-white tracking-tight">
            {scenario.title}
          </h2>
        </div>

        <div className="text-right">
          <span className="text-xs font-mono text-indigo-400 bg-indigo-950/80 px-2 py-1 rounded border border-indigo-900">
            Fase {currentPhase.phaseNumber} de {scenario.phases.length}
          </span>
        </div>
      </div>

      {/* Case Briefing Narrative Box */}
      <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 text-xs text-slate-300 space-y-2">
        <div className="flex items-start gap-2">
          <BookOpen className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sky-300">História Clínica: </span>
            <span>{scenario.briefing.patientDescription} </span>
            <span className="italic text-slate-400">{scenario.briefing.initialComplaint}</span>
          </div>
        </div>

        <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 text-slate-200 leading-relaxed text-xs">
          <span className="font-semibold text-emerald-400">Evolução no Leito: </span>
          {currentPhase.narrative}
        </div>

        {currentPhase.targetActionHint && (
          <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1.5 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>Dica de Ação Prática:</strong> {currentPhase.targetActionHint}
            </span>
          </div>
        )}
      </div>

      {/* Question and Multiple Choice Options */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <span>{question.title}</span>
          </div>
          <h3 className="text-sm md:text-base font-semibold text-white leading-snug">
            {question.question}
          </h3>
        </div>

        {/* Options A, B, C, D */}
        <div className="space-y-2">
          {question.options.map((opt) => {
            const isSelected = selectedOptionId === opt.id;
            const hasAnswered = selectedOptionId !== null;

            let btnStyle = 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700';
            if (hasAnswered) {
              if (opt.isCorrect) {
                btnStyle = 'bg-emerald-950/80 text-emerald-100 border-emerald-500 ring-2 ring-emerald-500/40';
              } else if (isSelected && !opt.isCorrect) {
                btnStyle = 'bg-rose-950/80 text-rose-200 border-rose-500 ring-2 ring-rose-500/40';
              } else {
                btnStyle = 'bg-slate-900/50 text-slate-500 border-slate-800 opacity-60';
              }
            }

            return (
              <button
                key={opt.id}
                onClick={() => handleChoose(opt.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${btnStyle}`}
              >
                <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center shrink-0 uppercase">
                  {opt.id}
                </span>
                <span className="text-xs md:text-sm flex-1 leading-snug">
                  {opt.text}
                </span>
                {hasAnswered && opt.isCorrect && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
                {hasAnswered && isSelected && !opt.isCorrect && (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Immediate Feedback Box & ACLS Explanation */}
        {showExplanation && selectedOption && (
          <div className="space-y-3 pt-2">
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed ${
                selectedOption.isCorrect
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-800 text-rose-200'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 mb-1 text-sm">
                {selectedOption.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Resposta Correta!
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-400" /> Atenção ao Protocolo
                  </>
                )}
              </div>
              <p>{selectedOption.feedback}</p>
              <p className="mt-2 text-slate-300 font-sans border-t border-slate-800 pt-1.5 text-[11px]">
                <strong className="text-indigo-300">Justificativa das Diretrizes: </strong>
                {question.explanation}
              </p>
            </div>

            {/* Advance Phase Button */}
            {hasNextPhase && (
              <button
                onClick={() => {
                  setSelectedOptionId(null);
                  setShowExplanation(false);
                  onAdvancePhase();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition active:scale-98"
              >
                <span>Avançar para Próxima Fase do Megacode</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
