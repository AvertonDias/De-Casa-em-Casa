"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Download, QrCode, Share2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface VisitorQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  territoryNumber: string | number;
  territoryName: string;
  congregationId: string;
  territoryId: string;
}

export default function VisitorQrModal({
  isOpen,
  onClose,
  territoryNumber,
  territoryName,
  congregationId,
  territoryId,
}: VisitorQrModalProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const visitorUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/visitante/${congregationId}/${territoryId}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(visitorUrl);
    setCopied(true);
    toast({ title: "Link copiado!", description: "Link de acesso para visitante copiado para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Território ${territoryNumber} - ${territoryName}`,
          text: `Acesse o Território ${territoryNumber} como visitante:`,
          url: visitorUrl,
        });
      } catch (err) {
        // Compartilhamento cancelado pelo usuário
      }
    } else {
      handleCopy();
    }
  };

  const handleDownloadQr = () => {
    const svg = document.getElementById("visitor-qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const qrImg = new Image();
    const logoImg = new Image();

    qrImg.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(qrImg, 0, 0, size, size);

      logoImg.onload = () => {
        // Proporção real da imagem original (586 x 557)
        const aspectRatio = 586 / 557;
        const logoHeight = Math.round(size * 0.22); // ~225px no canvas de 1024
        const logoWidth = Math.round(logoHeight * aspectRatio);
        const logoX = Math.round((size - logoWidth) / 2);
        const logoY = Math.round((size - logoHeight) / 2);

        // Fundo branco com cantos arredondados sob o logo para garantir contraste e leitura do QR Code
        const padding = Math.round(size * 0.012);
        const radius = Math.round(size * 0.018);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(logoX - padding, logoY - padding, logoWidth + padding * 2, logoHeight + padding * 2, radius);
        } else {
          ctx.rect(logoX - padding, logoY - padding, logoWidth + padding * 2, logoHeight + padding * 2);
        }
        ctx.fill();

        ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);

        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `qrcode-territorio-${territoryNumber}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
        toast({ title: "Download concluído", description: "QR Code em alta resolução com logotipo salvo como imagem PNG." });
      };

      logoImg.onerror = () => {
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `qrcode-territorio-${territoryNumber}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
        toast({ title: "Download concluído", description: "QR Code salvo como imagem PNG." });
      };

      logoImg.src = "/images/De%20casa%20em%20casa%20ico%20sem%20nome.png";
    };

    qrImg.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md p-5 sm:p-6 rounded-2xl mx-auto">
        <DialogHeader className="text-center sm:text-left">
          <DialogTitle className="flex items-center justify-center sm:justify-start gap-2 text-lg sm:text-xl font-bold">
            <QrCode className="text-primary h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
            QR Code para Visitantes
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Território {territoryNumber} - {territoryName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-4 sm:py-6 space-y-4">
          <div className="visitor-qr-code-container relative bg-white p-4 sm:p-5 rounded-2xl shadow-md border border-border flex items-center justify-center select-none">
            <QRCodeSVG
              id="visitor-qr-svg"
              value={visitorUrl}
              size={256}
              level={"H"}
              includeMargin={true}
              imageSettings={{
                src: "/images/De%20casa%20em%20casa%20ico%20sem%20nome.png",
                x: undefined,
                y: undefined,
                height: 56,
                width: 59,
                excavate: true,
              }}
            />
            {/* Camada nítida em alta definição com anti-aliasing otimizado centralizada sobre o QR Code */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center bg-white p-1 rounded-xl shadow-xs"
              style={{
                width: '64px',
                height: '61px',
              }}
              aria-hidden="true"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/De%20casa%20em%20casa%20ico%20sem%20nome.png"
                alt="Logotipo De casa em casa"
                width={59}
                height={56}
                className="w-full h-full object-contain"
                style={{
                  imageRendering: 'auto',
                  WebkitFontSmoothing: 'antialiased',
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
            Visitantes podem escanear este QR Code para acessar o território informando apenas o nome, sem precisar de cadastro, para marcar as casas trabalhadas.
          </p>

          <div className="w-full flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleCopy}
              className="flex-1 h-10 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar Link"}
            </Button>

            <Button
              onClick={handleShare}
              className="flex-1 h-10 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 shadow-sm"
            >
              <Share2 className="h-4 w-4" />
              Compartilhar Link
            </Button>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <Button variant="outline" onClick={handleDownloadQr} className="w-full sm:w-auto h-10 text-xs sm:text-sm font-medium">
            <Download className="mr-2 h-4 w-4" /> Baixar Imagem
          </Button>
          <Button onClick={onClose} className="w-full sm:w-auto h-10 text-xs sm:text-sm font-medium">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
