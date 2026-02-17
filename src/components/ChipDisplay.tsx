interface ChipDisplayProps {
  amount: number;
  size?: "sm" | "md" | "lg";
  variant?: "red" | "blue" | "green" | "gold";
}

const sizeClasses = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-10 h-10 text-xs",
  lg: "w-14 h-14 text-sm",
};

const variantClasses = {
  red: "chip-red",
  blue: "chip-blue",
  green: "chip-green",
  gold: "chip-gold",
};

export function ChipDisplay({ amount, size = "md", variant = "gold" }: ChipDisplayProps) {
  return (
    <div className={`chip ${sizeClasses[size]} ${variantClasses[variant] || "chip-gold"} text-white font-mono`}>
      <span className="relative z-10">
        {amount >= 1000 ? `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k` : amount}
      </span>
    </div>
  );
}

export function ChipStack({ amounts }: { amounts: number[] }) {
  return (
    <div className="flex items-center -space-x-2 hover:space-x-1 transition-all duration-300">
      {amounts.map((amount, i) => (
        <div key={i} className="transform hover:-translate-y-1 transition-transform">
          <ChipDisplay 
            amount={amount} 
            size="sm" 
            variant={amount >= 500 ? "gold" : amount >= 200 ? "red" : amount >= 100 ? "blue" : "green"} 
          />
        </div>
      ))}
    </div>
  );
}
