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
  id?: string;
  disabled?: boolean;
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 5,
  acceptedFileTypes = ["image/jpeg", "image/png", "application/pdf"],
  maxSizeInMB = 10,
  className,
  id = 'file-upload',
  disabled = false
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragging(true);
  }, [disabled]);

  const validateFiles = useCallback((filesToValidate: File[]): { validFiles: File[], newErrors: string[] } => {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    const validFiles: File[] = [];
    const newErrors: string[] = [];

    filesToValidate.forEach(file => {
      if (!acceptedFileTypes.includes(file.type)) {
        newErrors.push(`"${file.name}" is not supported. Choose a JPEG, PNG or PDF document.`);
        return;
      }

      if (!file.size || file.size > maxSizeInBytes) {
        newErrors.push(`"${file.name}" must be nonempty and no larger than ${maxSizeInMB} MiB.`);
        return;
      }

      validFiles.push(file);
    });

    if ((maxFiles === 1 ? 0 : files.length) + validFiles.length > maxFiles) {
      newErrors.push(`Cannot upload more than ${maxFiles} files.`);
      return { validFiles: [], newErrors };
    }

    return { validFiles, newErrors };
  }, [maxSizeInMB, acceptedFileTypes, maxFiles, files.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const { validFiles, newErrors } = validateFiles(droppedFiles);

      if (newErrors.length > 0) {
        setErrors(newErrors);
        return;
      }

      const updatedFiles = maxFiles === 1 ? validFiles : [...files, ...validFiles];
      setErrors([]);
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    }
  }, [disabled, files, onFilesSelected, validateFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      e.target.value = "";
      const { validFiles, newErrors } = validateFiles(selectedFiles);

      if (newErrors.length > 0) {
        setErrors(newErrors);
        return;
      }

      const updatedFiles = maxFiles === 1 ? validFiles : [...files, ...validFiles];
      setErrors([]);
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    }
  }, [disabled, files, onFilesSelected, validateFiles]);

  const removeFile = useCallback((index: number) => {
    if (disabled) return;
    const updatedFiles = [...files];
    updatedFiles.splice(index, 1);
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  }, [disabled, files, onFilesSelected]);

  const dismissError = useCallback((error: string) => {
    setErrors(prev => prev.filter(e => e !== error));
  }, []);

  return (
    <div className={className}>
      {errors.length > 0 && (
        <div className="mb-4" role="alert">
          {errors.map((error) => (
            <div key={error} className="flex items-center p-3 bg-red-50 border border-red-200 rounded text-red-700 mb-2">
              <span className="flex-1">{error}</span>
              <button type="button" aria-label="Dismiss file error" onClick={() => dismissError(error)} className="ml-2 p-2">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div 
        className={cn(
          "border-2 border-dashed rounded-lg p-6 transition-colors focus-within:ring-2 focus-within:ring-amber-700 focus-within:ring-offset-2",
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
            <label htmlFor={id} className="cursor-pointer text-amber-700 hover:text-amber-800 font-medium">
              Choose document
            </label>{" "}
            <span className="text-amber-600">or drag and drop</span>
            <p id={`${id}-help`} className="text-xs text-amber-800 mt-1">
              JPEG, PNG or PDF, up to {maxSizeInMB} MiB per file
            </p>
            <input
              id={id}
              name={id}
              type="file"
              disabled={disabled}
              className="sr-only"
              multiple={maxFiles > 1}
              aria-describedby={`${id}-help`}
              accept={acceptedFileTypes.join(",")}
              onChange={handleFileInputChange}
            />
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${file.lastModified}`} className="flex items-center p-2 bg-[#fff4d8] border border-amber-300 rounded">
              <File size={20} className="text-amber-700 mr-2" />
              <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
              <span className="text-xs text-amber-700 mx-2">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(index)}
                className="p-2 text-amber-700 hover:text-red-700"
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
