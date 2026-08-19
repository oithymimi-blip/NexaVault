import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function CountdownTimer() {
  const [targetDate, setTargetDate] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ days: '00', hours: '00', minutes: '00', seconds: '00' });

  useEffect(() => {
    fetchTargetDate();
    // Re-poll every 60 s so admin changes to the offset
    // are reflected on the user page without a hard refresh.
    const pollId = setInterval(fetchTargetDate, 60_000);
    return () => clearInterval(pollId);
  }, []);

  const fetchTargetDate = async () => {
    try {
      const data = await api.getCountdown();
      if (data && data.targetDate) {
        setTargetDate(data.targetDate);
      }
    } catch (err) {
      console.error('Failed to fetch countdown date:', err);
    }
  };

  useEffect(() => {
    if (!targetDate) return;

    const calculateTimeLeft = () => {
      const difference = +new Date(targetDate) - +new Date();
      if (difference <= 0) {
        return { days: '00', hours: '00', minutes: '00', seconds: '00' };
      }
      return {
        days: String(Math.floor(difference / (1000 * 60 * 60 * 24))),
        hours: String(Math.floor((difference / (1000 * 60 * 60)) % 24)).padStart(2, '0'),
        minutes: String(Math.floor((difference / 1000 / 60) % 60)).padStart(2, '0'),
        seconds: String(Math.floor((difference / 1000) % 60)).padStart(2, '0'),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="w-full max-w-2xl mx-auto my-10">
      <h3 className="text-center text-xs md:text-sm font-semibold text-slate-400 tracking-[0.25em] uppercase mb-4">
        Program Window Closes In:
      </h3>

      <div className="bg-[#212529]/90 backdrop-blur-md border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
          {/* Days */}
          <div className="bg-[#132723]/90 border border-emerald-500/20 rounded-2xl py-6 px-4 flex flex-col items-center justify-center shadow-inner hover:border-emerald-500/30 transition">
            <span className="text-3xl md:text-4xl lg:text-5xl font-extrabold font-mono text-emerald-400 tracking-wider">
              {timeLeft.days}
            </span>
            <span className="text-[10px] md:text-xs font-bold text-slate-400 tracking-[0.2em] uppercase mt-3">
              Days
            </span>
          </div>

          {/* Hours */}
          <div className="bg-[#132723]/90 border border-emerald-500/20 rounded-2xl py-6 px-4 flex flex-col items-center justify-center shadow-inner hover:border-emerald-500/30 transition">
            <span className="text-3xl md:text-4xl lg:text-5xl font-extrabold font-mono text-emerald-400 tracking-wider">
              {timeLeft.hours}
            </span>
            <span className="text-[10px] md:text-xs font-bold text-slate-400 tracking-[0.2em] uppercase mt-3">
              Hours
            </span>
          </div>

          {/* Minutes */}
          <div className="bg-[#132723]/90 border border-emerald-500/20 rounded-2xl py-6 px-4 flex flex-col items-center justify-center shadow-inner hover:border-emerald-500/30 transition">
            <span className="text-3xl md:text-4xl lg:text-5xl font-extrabold font-mono text-emerald-400 tracking-wider">
              {timeLeft.minutes}
            </span>
            <span className="text-[10px] md:text-xs font-bold text-slate-400 tracking-[0.2em] uppercase mt-3">
              Minutes
            </span>
          </div>

          {/* Seconds */}
          <div className="bg-[#132723]/90 border border-emerald-500/20 rounded-2xl py-6 px-4 flex flex-col items-center justify-center shadow-inner hover:border-emerald-500/30 transition">
            <span className="text-3xl md:text-4xl lg:text-5xl font-extrabold font-mono text-emerald-400 tracking-wider">
              {timeLeft.seconds}
            </span>
            <span className="text-[10px] md:text-xs font-bold text-slate-400 tracking-[0.2em] uppercase mt-3">
              Seconds
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
