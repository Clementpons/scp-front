"use client";

import { useRouter } from "next/navigation";
import { type Bapteme } from "@/components/booking/BaptemeCalendar";
import { BaptemeWeekCalendar } from "@/components/booking/BaptemeWeekCalendar";
import { useBaptemePrices } from "@/hooks/useBaptemePrices";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export function BaptemeCalendarSection() {
  const router = useRouter();
  const { getPrice: getBaptemePrice } = useBaptemePrices();

  const handleSlotSelect = (slot: Bapteme, category: string) => {
    const date = new Date(slot.date).toISOString().split("T")[0];
    router.push(
      `/reserver/bapteme?baptemeId=${slot.id}&baptemeCategory=${category}&date=${date}`,
    );
  };

  return (
    <section className="mx-4 my-16 lg:mx-36 xl:mx-64 2xl:mx-96">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          <h2 className="font-bold text-3xl text-slate-800">
            Créneaux disponibles
          </h2>
        </div>
        <p className="text-slate-500 max-w-xl mx-auto">
          Consultez les prochains créneaux de baptême et cliquez sur un créneau
          pour réserver directement.
        </p>
      </div>
      <Card className="shadow-sm">
        <CardContent className="p-3 sm:p-5">
          <BaptemeWeekCalendar
            onSlotSelect={handleSlotSelect}
            selectedSlot={null}
            getBaptemePrice={getBaptemePrice}
          />
        </CardContent>
      </Card>
    </section>
  );
}
