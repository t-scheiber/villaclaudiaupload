"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Upload, File, X } from "lucide-react";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  acceptedFileTypes?: string[];
  maxSizeInMB?: number;
  className?: string;
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 5,
  acceptedFileTypes = ["image/jpeg", "image/png", "application/pdf"],
  maxSizeInMB = 10,
  className,
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const validateFiles = useCallback((filesToValidate: File[]): { validFiles: File[], newErrors: string[] } => {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    const validFiles: File[] = [];
    const newErrors: string[] = [];

    filesToValidate.forEach(file => {
      if (!acceptedFileTypes.includes(file.type)) {
        newErrors.push(`"${file.name}" is not a supported file type. Please upload ${acceptedFileTypes.join(", ")}.`);
        return;
      }

      if (file.size > maxSizeInBytes) {
        newErrors.push(`"${file.name}" exceeds the maximum file size of ${maxSizeInMB}MB.`);
        return;
      }

      validFiles.push(file);
    });

    if (files.length + validFiles.length > maxFiles) {
      newErrors.push(`Cannot upload more than ${maxFiles} files.`);
      return { validFiles: [], newErrors };
    }

    return { validFiles, newErrors };
  }, [maxSizeInMB, acceptedFileTypes, maxFiles, files.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const { validFiles, newErrors } = validateFiles(droppedFiles);

      if (newErrors.length > 0) {
        setErrors(newErrors);
        return;
      }

      const updatedFiles = [...files, ...validFiles];
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    }
  }, [files, onFilesSelected, validateFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const { validFiles, newErrors } = validateFiles(selectedFiles);

      if (newErrors.length > 0) {
        setErrors(newErrors);
        return;
      }

      const updatedFiles = [...files, ...validFiles];
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    }
  }, [files, onFilesSelected, validateFiles]);

  const removeFile = useCallback((index: number) => {
    const updatedFiles = [...files];
    updatedFiles.splice(index, 1);
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  }, [files, onFilesSelected]);

  const dismissError = useCallback((index: number) => {
    const updatedErrors = [...errors];
    updatedErrors.splice(index, 1);
    setErrors(updatedErrors);
  }, [errors]);

  return (
    <div className={className}>
      {errors.length > 0 && (
        <div className="mb-4">
          {errors.map((error, index) => (
            <div key={index} className="flex items-center p-3 bg-red-50 border border-red-200 rounded text-red-700 mb-2">
              <span className="flex-1">{error}</span>
              <button onClick={() => dismissError(index)} className="ml-2">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div 
        className={cn(
          "border-2 border-dashed rounded-lg p-6 transition-colors",
          isDragging ? "border-amber-500 bg-[#fff4d8]" : "border-amber-300 hover:border-amber-400",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-amber-600" />
          <div className="mt-4">
            <label htmlFor="file-upload" className="cursor-pointer text-amber-700 hover:text-amber-800 font-medium">
              Click to upload
            </label>{" "}
            <span className="text-amber-600">or drag and drop</span>
            <p className="text-xs text-amber-600 mt-1">
              {acceptedFileTypes.map(type => type.split("/")[1]).join(", ")} up to {maxSizeInMB}MB (max {maxFiles} files)
            </p>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              multiple
              accept={acceptedFileTypes.join(",")}
              onChange={handleFileInputChange}
            />
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center p-2 bg-[#fff4d8] border border-amber-300 rounded">
              <File size={20} className="text-amber-700 mr-2" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-amber-700 mx-2">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
              <button 
                onClick={() => removeFile(index)}
                className="p-1 text-amber-500 hover:text-red-500"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 