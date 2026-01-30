// background.js

// 停止後の安全な設定（Stealth機能を全てOFFにする）
const safeConfig = {
  alwaysActive: false,
  mouseJiggler: false,
  autoScroll: false,
  userAgent: "default"
  // CAPTCHA検知は安全装置なのでONのままでも良いが、今回は「初期化」の意味合いで除外
};

// 1. ショートカットキーのリスナー
chrome.commands.onCommand.addListener((command) => {
  if (command === "stop-flexiclicker") {
    // Ctrl+Shift+E: 全タブ一時停止
    broadcastMessage({ type: "stopAutoClick" });
  } else if (command === "panic-reset-flexiclicker") {
    // Alt+Shift+P: パニックリセット（設定消去＋リロード）
    executePanicReset();
  }
});

// 2. Popupからのメッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "globalStop") {
    broadcastMessage({ type: "stopAutoClick" });
  } else if (message.type === "globalPanic") {
    executePanicReset();
  }
});

// パニックリセット実行関数
function executePanicReset() {
  // まず設定を強制的にOFFに書き換える
  chrome.storage.local.set(safeConfig, () => {
    // 書き換え完了後、全タブに「リロードせよ」と指令を出す
    broadcastMessage({ type: "panicClean" });
  });
}

// ヘルパー関数: 全タブにメッセージを一斉送信
function broadcastMessage(payload) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, payload).catch(() => {
          // 拡張機能が読み込まれていないタブのエラーは無視
        });
      }
    }
  });
}
