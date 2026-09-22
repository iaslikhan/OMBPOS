import React from 'react';
import { GeneratedPurchaseLabel } from '../services/purchaseLabelService';
import { Tag, Building2, Calendar, FileText, Package } from 'lucide-react';

interface PurchaseLabelCardProps {
  label: GeneratedPurchaseLabel;
  scale?: number;
}

export const PurchaseLabelCard: React.FC<PurchaseLabelCardProps> = ({ label, scale = 1 }) => {
  return (
    <div 
      className="bg-white text-black p-3.5 rounded-lg shadow-md border border-gray-300 font-sans select-none relative overflow-hidden flex flex-col justify-between"
      style={{
        width: '320px',
        minHeight: '190px',
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top left'
      }}
    >
      {/* Reprint Watermark / Badge */}
      {label.isReprint && (
        <div className="absolute top-1 right-1 bg-amber-100 border border-amber-400 text-amber-900 text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider">
          REPRINT
        </div>
      )}

      {/* Top: Brand & Product */}
      <div>
        <div className="text-center border-b border-dashed border-gray-400 pb-1.5 mb-1.5">
          <div className="text-[11px] font-black uppercase tracking-widest text-gray-900">
            {label.brandName}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-gray-600 font-semibold">
            Inward Stock & Purchase Identification
          </div>
        </div>

        {/* Product Name */}
        <div className="text-center my-1">
          <div className="text-sm font-black uppercase tracking-wide text-black line-clamp-1">
            {label.productName}
          </div>
        </div>

        {/* Code & Rate Badges (Prominent) */}
        <div className="flex items-center justify-center gap-2 my-1.5">
          <div className="bg-sky-50 border border-sky-300 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="text-[9px] font-bold text-sky-800">CODE:</span>
            <span className="text-xs font-black tracking-widest font-mono text-sky-950">
              {label.purchaseCode}
            </span>
          </div>

          <div className="bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="text-[9px] font-bold text-emerald-800">RATE:</span>
            <span className="text-xs font-black font-mono text-emerald-950">
              {label.purchaseRateDisplay}
            </span>
          </div>
        </div>

        {/* Bundle / Piece Index Info */}
        {label.bundleInfo && (
          <div className="text-center text-[10px] font-semibold text-gray-700 bg-gray-100 py-0.5 px-1.5 rounded border border-gray-200 my-1">
            {label.bundleInfo}
          </div>
        )}
      </div>

      {/* Middle: Barcode or QR */}
      <div className="my-1.5 text-center flex flex-col items-center justify-center">
        {label.barcodeType === 'QR' && label.qrDataUrl ? (
          <div className="flex items-center justify-center py-1">
            <img 
              src={label.qrDataUrl} 
              alt={`QR ${label.purchaseCode}`} 
              className="w-16 h-16 object-contain"
            />
          </div>
        ) : (
          <div 
            className="w-full flex justify-center overflow-hidden py-0.5"
            dangerouslySetInnerHTML={{ __html: label.barcodeSvg }}
          />
        )}
        <div className="text-[10px] font-mono font-bold tracking-widest text-gray-900 mt-0.5">
          *{label.purchaseCode}*
        </div>
      </div>

      {/* Bottom Footer Details (Supplier / Invoice / Date) */}
      <div className="border-t border-dashed border-gray-300 pt-1 mt-1 text-[8.5px] text-gray-600 flex items-center justify-between">
        <div className="truncate max-w-[170px]">
          {label.supplierName && (
            <span className="font-semibold text-gray-800 truncate block">
              {label.supplierName}
            </span>
          )}
          {label.invoiceNumber && (
            <span className="text-gray-500 font-mono">
              Inv: #{label.invoiceNumber}
            </span>
          )}
        </div>

        <div className="text-right whitespace-nowrap">
          {label.dateFormatted && (
            <span>{label.dateFormatted}</span>
          )}
        </div>
      </div>
    </div>
  );
};
