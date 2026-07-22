"use client";
import { UploadCloud, X } from "lucide-react";

interface ImageUploaderProps {
  existingImageUrl?: string | null;
  onFileSelect: (file: File | null) => void;
  onRemoveImage: () => void;
  selectedFile?: File | null;
}

export default function ImageUploader({ existingImageUrl, onFileSelect, onRemoveImage, selectedFile }: ImageUploaderProps) {
  const displayUrl = selectedFile ? URL.createObjectURL(selectedFile) : existingImageUrl;

  return (
    <div>
      <label className="block text-sm font-medium mb-1">Imagem do Cartão (Opcional)</label>
      <div className="mt-1 flex justify-center items-center rounded-lg border border-dashed border-gray-500 px-6 py-8 relative group min-h-[150px]">
        {displayUrl ? (
          <>
            <img src={displayUrl} alt="Preview do Cartão" className="max-h-32 object-contain rounded-md" />
            <button
              type="button"
              onClick={onRemoveImage}
              className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remover imagem"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <div className="text-center">
            <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
            <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-primary hover:text-primary/80">
              <span>Selecione um arquivo</span>
              <input id="file-upload" type="file" className="sr-only" onChange={(e) => onFileSelect(e.target.files ? e.target.files[0] : null)} accept="image/*" />
            </label>
            <p className="pl-1 text-xs">ou arraste e solte</p>
            <p className="text-xs leading-5 text-gray-500 mt-2">PNG, JPG, WEBP até 5MB</p>
          </div>
        )}
      </div>
    </div>
  );
}