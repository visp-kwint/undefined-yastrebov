"use client";

import { cn } from "@/lib/utils";

interface WelcomeScreenProps {
  onStart: () => void;
}

const SUGGESTIONS = [
  "Покажи выручку по месяцам и регионам",
  "Рассчитай ROI и маржинальность",
  "Построй прогноз на следующий квартал",
  "Найди корреляцию между расходами и прибылью",
  "Сгруппируй данные по категориям",
];

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10">
      <div className="flex items-center gap-5 mb-10 flex-wrap justify-center">
        <h1 className="text-6xl md:text-7xl font-normal text-dm-text tracking-wide">DataAnalyst</h1>
        <svg width="80" height="60" viewBox="0 0 99 79" fill="none">
          <rect x="0.1" width="46" height="30.3" rx="7" fill="#B3B3B3" />
          <rect y="7.2" width="98.3" height="71.8" rx="19" fill="#D9D9D9" />
        </svg>
      </div>

      <p className="text-dm-text-secondary text-center max-w-lg mb-8 leading-relaxed">
        Загрузите Excel или CSV файл и задавайте вопросы. AI рассчитает метрики, построит прогнозы и сгенерирует отчёты.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onStart()}
            className="text-left px-4 py-3 bg-dm-sidebar border border-dm-border rounded-xl text-sm text-dm-text-secondary hover:text-dm-text hover:border-dm-text-muted transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
