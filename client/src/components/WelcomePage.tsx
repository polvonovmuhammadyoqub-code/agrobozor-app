import {
  Sprout,
  ArrowRight,
  Tractor,
  Truck,
  ShoppingBasket,
} from 'lucide-react';
export function WelcomePage({
  onLogin,
  onRegister,
  onMarket,
}: {
  onLogin: () => void;
  onRegister: () => void;
  onMarket: () => void;
}) {
  return (
    <section
      aria-label="Xush kelibsiz"
      className="min-h-[100dvh] bg-[#f6f8f2] flex flex-col px-6 py-8 sm:py-12"
    >
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center gap-7">
        <div className="flex items-center gap-2 font-black text-2xl text-agro-dark">
          <span className="rounded-2xl bg-agro-green text-white p-3">
            <Sprout size={26} />
          </span>
          Agro<span className="text-amber-600 -ml-2">Bozor</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-emerald-700 font-bold mb-3">
            Daladan dasturxonga
          </p>
          <h1 className="text-4xl font-black leading-tight text-agro-dark">
            Hosilingizga bozor.
            <br />
            Xaridingizga ishonch.
          </h1>
          <p className="mt-4 text-gray-600 text-sm leading-6">
            Fermer, xaridor va logist — barchasi bir joyda. Hisobingizga kiring
            yoki yangi hisob oching.
          </p>
        </div>
        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full rounded-2xl bg-agro-green text-white py-4 px-5 font-bold flex items-center justify-between"
          >
            Kirish
            <ArrowRight size={20} />
          </button>
          <button
            onClick={onRegister}
            className="w-full rounded-2xl bg-white border-2 border-agro-green text-agro-green py-4 font-bold"
          >
            Ro‘yxatdan o‘tish
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs text-gray-600">
          {[
            [Tractor, 'Fermer'],
            [ShoppingBasket, 'Xaridor'],
            [Truck, 'Logist'],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Tractor;
            return (
              <div
                key={String(label)}
                className="bg-white rounded-2xl py-4 border border-gray-100"
              >
                <I className="mx-auto mb-2 text-emerald-700" size={23} />
                {String(label)}
              </div>
            );
          })}
        </div>
        <button
          onClick={onMarket}
          className="text-sm text-agro-green font-semibold py-2"
        >
          Avval bozorni ko‘rib chiqish →
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 pt-7">
        Yangi hosil. Bevosita muloqot. Qulay savdo.
      </p>
    </section>
  );
}
