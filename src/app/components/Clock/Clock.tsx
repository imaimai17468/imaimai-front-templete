type ClockProps = {
  time: string;
};

export const Clock = ({ time }: ClockProps) => (
  <div
    aria-label="現在の日本時間"
    className="font-mono text-2xl tabular-nums"
    role="timer"
  >
    {time}
  </div>
);
