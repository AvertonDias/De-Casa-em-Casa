"use client";

import { useState } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "@/lib/firebase";

const storage = getStorage(app);

export default function UploadTestPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<string>('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setFeedback('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setFeedback("Erro: Nenhum arquivo selecionado.");
      return;
    }

    setIsUploading(true);
    setFeedback("Iniciando upload...");

    // Usando um caminho simples e direto para o teste
    const filePath = `debug_uploads/${Date.now()}-${selectedFile.name}`;
    const storageRef = ref(storage, filePath);
    const metadata = { contentType: selectedFile.type };

    try {
      setFeedback("Enviando arquivo para o Storage...");
      const uploadTask = await uploadBytes(storageRef, selectedFile, metadata);
      
      setFeedback("Upload completo! Obtendo URL...");
      const downloadURL = await getDownloadURL(uploadTask.ref);

      console.log("SUCESSO! URL de download:", downloadURL);
      setFeedback(`SUCESSO! Arquivo enviado para: ${downloadURL}`);

    } catch (error: any) {
      console.error("ERRO NO TESTE DE UPLOAD:", error);
      setFeedback(`FALHA: ${error.code} - ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Página de Teste de Upload</h1>
      <p>Esta página testa apenas a funcionalidade de upload para o Firebase Storage.</p>
      
      <div>
        <label htmlFor="file-input" className="block mb-2">1. Selecione um arquivo de imagem:</label>
        <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} className="bg-card p-2 rounded-md" />
      </div>
      
      <button onClick={handleUpload} disabled={isUploading || !selectedFile} className="bg-primary text-white px-4 py-2 rounded-md disabled:opacity-50">
        {isUploading ? "Enviando..." : "2. Testar Upload"}
      </button>

      {feedback && (
        <div className="mt-4 p-4 bg-card rounded-md">
          <p className="font-mono text-sm">{feedback}</p>
        </div>
      )}
    </div>
  );
}