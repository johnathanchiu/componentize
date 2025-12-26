import ProductInfo from "./ProductInfo";
import ProductPrice from "./ProductPrice";
import SizeSelector from "./SizeSelector";
import AddToCartBtn from "./AddToCartBtn";

export default function ProductDetails() {
  return (
    <div className="w-full h-full flex flex-col gap-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
      <div className="flex-shrink-0" style={{ height: 180 }}>
        <ProductInfo />
      </div>
      <div className="flex-shrink-0" style={{ height: 50 }}>
        <ProductPrice />
      </div>
      <div className="flex-shrink-0" style={{ height: 100 }}>
        <SizeSelector />
      </div>
      <div className="flex-shrink-0" style={{ height: 56 }}>
        <AddToCartBtn />
      </div>
    </div>
  );
}
