/**
 * fileHandler.js
 * ファイルアップロード関連の機能を提供します
 */

// 選択したファイルを保持する変数
let selectedFiles = [];

// ファイル選択処理
export function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    selectedFiles = files;

    // 入力エリアにプレビューを追加
    const inputWrapper = document.querySelector('.input-wrapper');
    const existingPreview = inputWrapper.querySelector('.file-preview');
    if (existingPreview) {
        existingPreview.remove();
    }

    const previewArea = document.createElement('div');
    previewArea.classList.add('file-preview');

    files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.classList.add('file-preview-item');
        fileItem.innerHTML = `
            ${file.name}
            <span class="remove-file" data-index="${index}">
                <i class="fas fa-times"></i>
            </span>
        `;

        // ファイル削除イベント
        fileItem.querySelector('.remove-file').addEventListener('click', () => {
            selectedFiles = selectedFiles.filter((_, i) => i !== index);
            fileItem.remove();
            if (selectedFiles.length === 0 && previewArea.parentNode) {
                previewArea.remove();
            }
        });

        previewArea.appendChild(fileItem);
    });

    if (files.length > 0) {
        inputWrapper.insertBefore(previewArea, document.getElementById('userInput'));
    }
}

// ファイルをBase64として読み込む
export function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 選択されたファイルを取得
export function getSelectedFiles() {
    return selectedFiles;
}

// 選択されたファイルをクリア
export function clearSelectedFiles() {
    selectedFiles = [];
    
    // プレビューをクリア
    const previewArea = document.querySelector('.file-preview');
    if (previewArea) {
        previewArea.remove();
    }
}