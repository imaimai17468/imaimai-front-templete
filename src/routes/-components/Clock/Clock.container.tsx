import { useEffect, useState } from "react";
import { Clock } from "./Clock";
import { formatJapanTime } from "./utils";

export const ClockContainer = () => {
  const [time, setTime] = useState(() => formatJapanTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => {
      setTime(formatJapanTime(new Date()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <Clock time={time} />;
};
