import React, { useState } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="ml-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <span>
                  {format(dateRange.from, "LLL dd, y", { locale: ar })} -{" "}
                  {format(dateRange.to, "LLL dd, y", { locale: ar })}
                </span>
              ) : (
                format(dateRange.from, "LLL dd, y", { locale: ar })
              )
            ) : (
              <span>اختر فترة زمنية</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={(range) => {
              onDateRangeChange(range);
              if (range?.to) {
                setIsOpen(false);
              }
            }}
            numberOfMonths={2}
            locale={ar}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Preset date ranges for quick selection
export function getPresetDateRanges() {
  const today = new Date();
  
  // Set to start of day
  today.setHours(0, 0, 0, 0);
  
  // Last 7 days
  const last7Days = new Date(today);
  last7Days.setDate(today.getDate() - 6);
  
  // Last 30 days
  const last30Days = new Date(today);
  last30Days.setDate(today.getDate() - 29);
  
  // This month
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  // Last month
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  
  // This year
  const thisYear = new Date(today.getFullYear(), 0, 1);
  const endOfYear = new Date(today.getFullYear(), 11, 31);
  
  return [
    {
      label: "آخر 7 أيام",
      range: { from: last7Days, to: today }
    },
    {
      label: "آخر 30 يوم",
      range: { from: last30Days, to: today }
    },
    {
      label: "هذا الشهر",
      range: { from: thisMonth, to: endOfMonth }
    },
    {
      label: "الشهر الماضي",
      range: { from: lastMonth, to: endOfLastMonth }
    },
    {
      label: "هذا العام",
      range: { from: thisYear, to: endOfYear }
    }
  ];
}

export function DateRangePresets({ 
  onSelect 
}: { 
  onSelect: (range: DateRange) => void 
}) {
  const presets = getPresetDateRanges();
  
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {presets.map((preset, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onSelect(preset.range)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}