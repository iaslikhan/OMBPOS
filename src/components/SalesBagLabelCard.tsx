import React from 'react';
import { GeneratedBagLabel } from '../services/salesLabelService';

interface SalesBagLabelCardProps {
  label: GeneratedBagLabel;
  paperSize?: string;
  showBundleInfo?: boolean;
}

export const SalesBagLabelCard: React.FC<SalesBagLabelCardProps> = ({
  label,
  paperSize = '50x30 mm',
  showBundleInfo = true
}) => {
  return (
    <div
      className="bg-white text-black p-2.5 rounded-md border border-gray-400 shadow-sm font-sans flex flex-col justify-between items-center text-center select-none print:shadow-none print:border-black"
      style={{
        width: paperSize === '40x30 mm' ? '150px' : paperSize === '50x25 mm' ? '180px' : '190px',
        minHeight: paperSize === '50x25 mm' ? '95px' : '115px'
      }}
    >
      {/* 1. Brand: ORIGINAL MODI BAGS */}
      <div className="w-full border-b border-black pb-0.5 mb-1">
        <div className="text-[10px] font-black uppercase tracking-wider leading-none text-black">
          {label.brandName || 'ORIGINAL MODI BAGS'}
        </div>
      </div>

      {/* 2. Product Name */}
      <div className="w-full px-0.5 my-0.5">
        <div className="text-[11px] font-black uppercase tracking-wide truncate text-black leading-tight">
          {label.productName}
        </div>
      </div>

      {/* 3. Encoded Private Item Code (CRITICAL: '6' + integer price) */}
      <div className="my-0.5 py-0.5 px-2 bg-gray-100 border border-black rounded inline-block">
        <div className="text-[7px] font-bold text-gray-700 uppercase tracking-widest leading-none">
          ITEM CODE
        </div>
        <div className="text-sm font-black font-mono tracking-widest text-black leading-none mt-0.5">
          {label.itemCode}
        </div>
      </div>

      {/* 4. Barcode (Code 128 or QR) */}
      <div className="w-full flex flex-col items-center justify-center my-0.5">
        {label.qrDataUrl ? (
          <img src={label.qrDataUrl} alt="QR Code" className="w-12 h-12" />
        ) : (
          <div
            className="w-full max-w-[150px] overflow-hidden"
            dangerouslySetInnerHTML={{ __html: label.barcodeSvg }}
          />
        )}
        <div className="text-[8px] font-mono tracking-widest text-gray-800 font-bold mt-0.5">
          *{label.itemCode}*
        </div>
      </div>

      {/* Bundle / Copy indicator */}
      {showBundleInfo && (
        <div className="w-full flex justify-between items-center text-[7px] text-gray-600 font-mono border-t border-gray-300 pt-0.5 mt-0.5">
          <span>{label.bundleQuantityNote || 'WHOLESALE'}</span>
          <span>TAG {label.copyIndex}/{label.totalCopies}</span>
        </div>
      )}
    </div>
  );
};
