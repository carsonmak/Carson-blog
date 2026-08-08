/* ============================================================
   DZ (Discuz!) 论坛风格编辑器 - 核心逻辑
   模仿 Discuz! X3 论坛系统发帖编辑器
   暴露全局：window.DzEditor
   用法：
     var editor = new DzEditor({
       container: document.getElementById('dzEditorWrap'),
       textarea:  document.getElementById('postContent'),
       placeholder: '请输入文章内容...',
       onUploadImage: async function(file) { return { url: '...', html: '...' }; }
     });
     editor.setContent(html);   // 设置内容
     editor.getContent();        // 获取 HTML
     editor.sync();              // 同步到 textarea
   ============================================================ */

(function () {
  'use strict';

  /* -------------------- 工具函数 -------------------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  // SVG 图标库（精简版，模仿 Discuz! 工具栏图标）
  var ICONS = {
    bold: '<svg viewBox="0 0 24 24"><path d="M15.6 11.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 7.5h3a1.5 1.5 0 010 3h-3v-3zm3.5 9H10v-3h3.5a1.5 1.5 0 010 3z"/></svg>',
    italic: '<svg viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>',
    underline: '<svg viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zM5 19v2h14v-2H5z"/></svg>',
    strike: '<svg viewBox="0 0 24 24"><path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/></svg>',
    color: '<svg viewBox="0 0 24 24"><path d="M11 3L5.5 17h2.25l1.12-3h6.25l1.13 3h2.25L14 3h-3zm-1.38 9L12 5.67 14.38 12H9.62z"/></svg>',
    hilite: '<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" opacity=".35"/><path d="M3 17h18v2H3z"/></svg>',
    alignLeft: '<svg viewBox="0 0 24 24"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>',
    alignCenter: '<svg viewBox="0 0 24 24"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>',
    alignRight: '<svg viewBox="0 0 24 24"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg>',
    ol: '<svg viewBox="0 0 24 24"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>',
    ul: '<svg viewBox="0 0 24 24"><path d="M4 10.5c.83 0 1.5-.67 1.5-1.5S4.83 7.5 4 7.5 2.5 8.17 2.5 9s.67 1.5 1.5 1.5zm0-6c.83 0 1.5-.67 1.5-1.5S4.83 1.5 4 1.5 2.5 2.17 2.5 3 3.17 4.5 4 4.5zm0 12c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>',
    outdent: '<svg viewBox="0 0 24 24"><path d="M11 17h10v-2H11v2zm0-4h10v-2H11v2zM3 9v6l4-3-4-3zm8 2h10V9H11v2zm0-6v2h10V5H11z"/></svg>',
    indent: '<svg viewBox="0 0 24 24"><path d="M3 9v6l4-3-4-3zm8 8h10v-2H11v2zm0-4h10v-2H11v2zm0-6v2h10V7H11zM3 5v2h18V5H3z"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M3.9 12a3.1 3.1 0 013.1-3.1h4V7H7a5 5 0 000 10h4v-1.9H7A3.1 3.1 0 013.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 010 6.2h-4V17h4a5 5 0 000-10z"/></svg>',
    unlink: '<svg viewBox="0 0 24 24"><path d="M17 7h-4v1.9h4a3.1 3.1 0 010 6.2h-4V17h4a5 5 0 000-10zM3.9 12a3.1 3.1 0 013.1-3.1h4V7H7a5 5 0 000 10h4v-1.9H7A3.1 3.1 0 013.9 12zm5.69-1.98L8.18 8.6 6.05 10.73l1.41 1.41 2.13-2.12zm8.48 6.36l1.41-1.41-2.13-2.13-1.41 1.41 2.13 2.13z"/></svg>',
    image: '<svg viewBox="0 0 24 24"><path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z"/></svg>',
    smiley: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>',
    quote: '<svg viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z"/></svg>',
    code: '<svg viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>',
    hr: '<svg viewBox="0 0 24 24"><path d="M3 11h18v2H3z"/></svg>',
    clear: '<svg viewBox="0 0 24 24"><path d="M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5l.93.93L13.45 12.45 14.5 10h2L12 5H6z"/></svg>',
    source: '<svg viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>',
    attach: '<svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>'
  };

  // 颜色表（模仿 Discuz! 颜色选择器）
  var COLORS = [
    '#000000', '#444444', '#666666', '#999999', '#cccccc', '#eeeeee', '#ffffff', '#ff0000',
    '#ff6600', '#ff9900', '#ffcc00', '#ffff00', '#99cc00', '#669900', '#339933', '#009933',
    '#009966', '#009999', '#0066cc', '#003399', '#330099', '#660099', '#993399', '#cc00cc',
    '#ff00ff', '#ff3399', '#ff6699', '#ff9999', '#ffcccc', '#cc9966', '#996633', '#663300'
  ];

  // 表情表（分类 + Emoji）
  var SMILEYS = {
    '默认': ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥'],
    '表情': ['😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🫠','🤑','🤠','🤡','🥳','🥺','🤓','🧐','😢','😭','😤','😠','😡','🤬'],
    '手势': ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','🙏','💪','👏','🙌','🫶','❤️','🧡','💛','💚','💙','💜'],
    '物品': ['☕','🍵','🍰','🍔','🍟','🍕','🍜','🍣','🍦','🍷','🍺','🎉','🎊','🎁','🎂','🎵','🎮','⚽','🏀','🏆','🚗','✈️','🏠','💰','📱','💻','📷','📚','✏️','💡']
  };

  var FONTS = [
    { name: '默认字体', value: '' },
    { name: '宋体', value: 'SimSun, serif' },
    { name: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
    { name: '黑体', value: 'SimHei, sans-serif' },
    { name: '楷体', value: 'KaiTi, serif' },
    { name: '仿宋', value: 'FangSong, serif' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Times New Roman', value: '"Times New Roman", serif' },
    { name: 'Courier New', value: '"Courier New", monospace' }
  ];

  var FONT_SIZES = [
    { name: '字号', value: '3' },
    { name: '极小', value: '1' },
    { name: '小', value: '2' },
    { name: '正常', value: '3' },
    { name: '大', value: '5' },
    { name: '较大', value: '6' },
    { name: '极大', value: '7' }
  ];

  /* -------------------- 选区存取 -------------------- */

  // 保存当前选区（用于弹出面板后恢复）
  var savedRange = null;
  function saveSelection() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    if (!savedRange) return;
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  /* -------------------- 编辑器构造函数 -------------------- */

  function DzEditor(options) {
    this.options = options || {};
    this.container = options.container;
    this.textarea = options.textarea;
    this.placeholder = options.placeholder || '请在此输入内容...';
    this.onUploadImage = options.onUploadImage || null;
    this.sourceMode = false;
    this.popover = null;
    this.modal = null;

    if (!this.container) return;
    this._build();
    this._bind();
    // 初始化内容
    var init = (this.textarea && this.textarea.value) || '';
    this.setContent(init);
  }

  DzEditor.prototype._build = function () {
    var self = this;
    this.container.innerHTML = '';
    this.container.className = 'dz-editor';

    // ---- 工具栏 ----
    var toolbar = el('div', { class: 'dz-editor-toolbar' });

    // 字体/字号组
    var g1 = el('div', { class: 'dz-toolbar-group' });
    var fontSelect = el('select', { class: 'dz-select', title: '字体' });
    FONTS.forEach(function (f) {
      fontSelect.appendChild(el('option', { value: f.value, text: f.name }));
    });
    fontSelect.addEventListener('change', function () {
      self._focus();
      if (fontSelect.value) {
        document.execCommand('fontName', false, fontSelect.value);
      } else {
        document.execCommand('removeFormat', false, 'fontName');
      }
    });
    var sizeSelect = el('select', { class: 'dz-select', title: '字号' });
    FONT_SIZES.forEach(function (s) {
      sizeSelect.appendChild(el('option', { value: s.value, text: s.name }));
    });
    sizeSelect.addEventListener('change', function () {
      self._focus();
      document.execCommand('fontSize', false, sizeSelect.value);
    });
    g1.appendChild(fontSelect);
    g1.appendChild(sizeSelect);

    // 文字样式组
    var g2 = el('div', { class: 'dz-toolbar-group' });
    g2.appendChild(self._btn('bold', '加粗', ICONS.bold, function () { self._exec('bold'); }));
    g2.appendChild(self._btn('italic', '斜体', ICONS.italic, function () { self._exec('italic'); }));
    g2.appendChild(self._btn('underline', '下划线', ICONS.underline, function () { self._exec('underline'); }));
    g2.appendChild(self._btn('strikethrough', '删除线', ICONS.strike, function () { self._exec('strikeThrough'); }));
    // 文字颜色
    var colorBtn = self._btn('color', '文字颜色', ICONS.color + '<span class="dz-color-bar"></span>', function (e) {
      self._toggleColorPopover(e.currentTarget, 'foreColor');
    });
    colorBtn.classList.add('dz-color-btn');
    g2.appendChild(colorBtn);
    // 背景色
    var hlBtn = self._btn('hilite', '背景颜色', ICONS.hilite, function (e) {
      self._toggleColorPopover(e.currentTarget, 'hiliteColor');
    });
    g2.appendChild(hlBtn);

    // 对齐组
    var g3 = el('div', { class: 'dz-toolbar-group' });
    g3.appendChild(self._btn('alignLeft', '左对齐', ICONS.alignLeft, function () { self._exec('justifyLeft'); }));
    g3.appendChild(self._btn('alignCenter', '居中', ICONS.alignCenter, function () { self._exec('justifyCenter'); }));
    g3.appendChild(self._btn('alignRight', '右对齐', ICONS.alignRight, function () { self._exec('justifyRight'); }));

    // 列表/缩进组
    var g4 = el('div', { class: 'dz-toolbar-group' });
    g4.appendChild(self._btn('ul', '无序列表', ICONS.ul, function () { self._exec('insertUnorderedList'); }));
    g4.appendChild(self._btn('ol', '有序列表', ICONS.ol, function () { self._exec('insertOrderedList'); }));
    g4.appendChild(self._btn('indent', '增加缩进', ICONS.indent, function () { self._exec('indent'); }));
    g4.appendChild(self._btn('outdent', '减少缩进', ICONS.outdent, function () { self._exec('outdent'); }));

    // 插入组
    var g5 = el('div', { class: 'dz-toolbar-group' });
    g5.appendChild(self._btn('link', '插入链接', ICONS.link, function () { self._openLinkModal(); }));
    g5.appendChild(self._btn('unlink', '取消链接', ICONS.unlink, function () { self._exec('unlink'); }));
    g5.appendChild(self._btn('image', '插入图片', ICONS.image, function () { self._openImageModal(); }));
    g5.appendChild(self._btn('smiley', '表情', ICONS.smiley, function (e) { self._toggleSmileyPopover(e.currentTarget); }));

    // 块级组
    var g6 = el('div', { class: 'dz-toolbar-group' });
    g6.appendChild(self._btn('quote', '引用', ICONS.quote, function () { self._wrapBlock('blockquote'); }));
    g6.appendChild(self._btn('code', '代码', ICONS.code, function () { self._insertCode(); }));
    g6.appendChild(self._btn('hr', '分割线', ICONS.hr, function () { self._exec('insertHorizontalRule'); }));

    // 功能组
    var g7 = el('div', { class: 'dz-toolbar-group' });
    g7.appendChild(self._btn('clear', '清除格式', ICONS.clear, function () { self._exec('removeFormat'); }));
    g7.appendChild(self._btn('source', '源码模式', ICONS.source, function (e) { self._toggleSource(e.currentTarget); }));

    toolbar.appendChild(g1);
    toolbar.appendChild(g2);
    toolbar.appendChild(g3);
    toolbar.appendChild(g4);
    toolbar.appendChild(g5);
    toolbar.appendChild(g6);
    toolbar.appendChild(g7);

    // ---- 第二排：表情/附件/字数 ----
    var bar2 = el('div', { class: 'dz-editor-bar2' });
    var bar2Left = el('div', { class: 'dz-bar2-left' });
    var smileyLink = el('span', {
      class: 'dz-bar2-link',
      html: ICONS.smiley + '<span>表情</span>',
      title: '插入表情'
    });
    smileyLink.addEventListener('click', function (e) {
      self._toggleSmileyPopover(smileyLink);
    });
    var attachLink = el('span', {
      class: 'dz-bar2-link',
      html: ICONS.image + '<span>图片</span>',
      title: '插入图片'
    });
    attachLink.addEventListener('click', function () { self._openImageModal(); });
    bar2Left.appendChild(smileyLink);
    bar2Left.appendChild(attachLink);

    var charCount = el('span', { class: 'dz-char-count', html: '已输入 <b id="dzCharNum">0</b> 字' });
    bar2.appendChild(bar2Left);
    bar2.appendChild(charCount);

    // ---- 编辑区 ----
    var bodyWrap = el('div', { class: 'dz-editor-body-wrap' });
    this.area = el('div', {
      class: 'dz-editor-area',
      contenteditable: 'true',
      'data-placeholder': this.placeholder,
      role: 'textbox',
      'aria-multiline': 'true'
    });
    this.sourceArea = el('textarea', { class: 'dz-source-area', placeholder: '在此查看 / 编辑 HTML 源码' });
    bodyWrap.appendChild(this.area);
    bodyWrap.appendChild(this.sourceArea);

    this.container.appendChild(toolbar);
    this.container.appendChild(bar2);
    this.container.appendChild(bodyWrap);

    // 弹层容器（挂到 body）
    this.popover = el('div', { class: 'dz-popover' });
    document.body.appendChild(this.popover);
  };

  DzEditor.prototype._btn = function (name, title, iconHtml, handler) {
    var btn = el('button', {
      type: 'button',
      class: 'dz-btn',
      title: title,
      html: iconHtml
    });
    btn.addEventListener('mousedown', function (e) {
      // 阻止失焦，保持编辑区选区
      e.preventDefault();
    });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      handler(e);
    });
    return btn;
  };

  DzEditor.prototype._focus = function () {
    if (this.sourceMode) {
      this.sourceArea.focus();
    } else {
      this.area.focus();
    }
  };

  DzEditor.prototype._exec = function (cmd, value) {
    this._focus();
    if (this.sourceMode) return;
    try { document.execCommand(cmd, false, value || null); } catch (e) {}
    this._updateCharCount();
    this.sync();
  };

  /* -------------------- 颜色面板 -------------------- */

  DzEditor.prototype._toggleColorPopover = function (anchor, cmd) {
    var self = this;
    if (this.popover.dataset.type === 'color:' + cmd && this.popover.classList.contains('show')) {
      this._hidePopover();
      return;
    }
    saveSelection();
    this._hidePopover();
    this.popover.dataset.type = 'color:' + cmd;
    this.popover.innerHTML = '';
    var title = el('div', { class: 'dz-popover-title', text: cmd === 'foreColor' ? '文字颜色' : '背景颜色' });
    var grid = el('div', { class: 'dz-color-grid' });
    COLORS.forEach(function (c) {
      var cell = el('div', { class: 'dz-color-cell', title: c, style: 'background:' + c });
      cell.addEventListener('mousedown', function (e) { e.preventDefault(); });
      cell.addEventListener('click', function () {
        restoreSelection();
        self._focus();
        document.execCommand(cmd, false, c);
        self._hidePopover();
        self.sync();
      });
      grid.appendChild(cell);
    });
    var remove = el('div', { class: 'dz-popover-remove', text: '清除颜色' });
    remove.addEventListener('mousedown', function (e) { e.preventDefault(); });
    remove.addEventListener('click', function () {
      restoreSelection();
      self._focus();
      document.execCommand(cmd, false, 'transparent');
      self._hidePopover();
      self.sync();
    });
    this.popover.appendChild(title);
    this.popover.appendChild(grid);
    this.popover.appendChild(remove);
    this._showPopover(anchor);
  };

  /* -------------------- 表情面板 -------------------- */

  DzEditor.prototype._toggleSmileyPopover = function (anchor) {
    var self = this;
    if (this.popover.dataset.type === 'smiley' && this.popover.classList.contains('show')) {
      this._hidePopover();
      return;
    }
    saveSelection();
    this._hidePopover();
    this.popover.dataset.type = 'smiley';
    this.popover.innerHTML = '';

    var tabs = el('div', { class: 'dz-smiley-tabs' });
    var grid = el('div', { class: 'dz-smiley-grid' });
    var cats = Object.keys(SMILEYS);

    function renderCat(cat) {
      grid.innerHTML = '';
      SMILEYS[cat].forEach(function (s) {
        var item = el('div', { class: 'dz-smiley-item', text: s, title: s });
        item.addEventListener('mousedown', function (e) { e.preventDefault(); });
        item.addEventListener('click', function () {
          restoreSelection();
          self._insertText(s);
          self._hidePopover();
        });
        grid.appendChild(item);
      });
    }

    cats.forEach(function (cat, i) {
      var tab = el('div', { class: 'dz-smiley-tab' + (i === 0 ? ' active' : ''), text: cat });
      tab.addEventListener('click', function () {
        tabs.querySelectorAll('.dz-smiley-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        renderCat(cat);
      });
      tabs.appendChild(tab);
    });

    renderCat(cats[0]);
    this.popover.appendChild(tabs);
    this.popover.appendChild(grid);
    this._showPopover(anchor);
  };

  DzEditor.prototype._insertText = function (text) {
    this._focus();
    if (this.sourceMode) {
      this.sourceArea.value += text;
      return;
    }
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && this.area.contains(sel.anchorNode)) {
      var range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      this.area.appendChild(document.createTextNode(text));
    }
    this._updateCharCount();
    this.sync();
  };

  /* -------------------- 弹层定位 -------------------- */

  DzEditor.prototype._showPopover = function (anchor) {
    var rect = anchor.getBoundingClientRect();
    this.popover.classList.add('show');
    var pw = this.popover.offsetWidth;
    var left = rect.left + window.pageXOffset;
    if (left + pw > window.innerWidth - 8) {
      left = window.innerWidth - pw - 8 + window.pageXOffset;
    }
    this.popover.style.left = Math.max(8, left) + 'px';
    this.popover.style.top = (rect.bottom + window.pageYOffset + 2) + 'px';
  };

  DzEditor.prototype._hidePopover = function () {
    this.popover.classList.remove('show');
    delete this.popover.dataset.type;
  };

  /* -------------------- 链接弹窗 -------------------- */

  DzEditor.prototype._openLinkModal = function () {
    var self = this;
    saveSelection();
    // 尝试读取已选链接
    var existingUrl = '';
    var existingText = '';
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      var node = sel.anchorNode;
      while (node && node !== this.area) {
        if (node.nodeName === 'A') {
          existingUrl = node.getAttribute('href') || '';
          existingText = node.textContent || '';
          break;
        }
        node = node.parentNode;
      }
      if (!existingText && sel.toString()) existingText = sel.toString();
    }

    var mask = el('div', { class: 'dz-modal-mask' });
    var modal = el('div', { class: 'dz-modal' });
    var header = el('div', { class: 'dz-modal-header', html: '<span>插入链接</span>' });
    var closeBtn = el('button', { class: 'dz-modal-close', text: '×' });
    header.appendChild(closeBtn);
    var body = el('div', { class: 'dz-modal-body' });
    var textInput = el('input', { type: 'text', value: existingText, placeholder: '链接显示文字（选填）' });
    var urlInput = el('input', { type: 'url', value: existingUrl, placeholder: 'https://example.com' });
    body.appendChild(el('div', { class: 'dz-modal-field' }, [el('label', { text: '显示文字' }), textInput]));
    body.appendChild(el('div', { class: 'dz-modal-field' }, [el('label', { text: '链接地址' }), urlInput]));
    var footer = el('div', { class: 'dz-modal-footer' });
    var cancelBtn = el('button', { class: 'dz-modal-btn', text: '取消' });
    var okBtn = el('button', { class: 'dz-modal-btn dz-modal-primary', text: '确定' });
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    mask.appendChild(modal);
    document.body.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('show'); urlInput.focus(); });

    function close() { mask.classList.remove('show'); setTimeout(function () { mask.remove(); }, 200); }
    function confirm() {
      var url = urlInput.value.trim();
      var text = textInput.value.trim();
      if (!url) { urlInput.focus(); return; }
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) url = 'https://' + url;
      restoreSelection();
      self._focus();
      if (text) {
        document.execCommand('insertHTML', false, '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(text) + '</a>');
      } else {
        document.execCommand('createLink', false, url);
      }
      close();
      self.sync();
    }
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    okBtn.addEventListener('click', confirm);
    urlInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); confirm(); } });
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
  };

  /* -------------------- 图片弹窗 -------------------- */

  DzEditor.prototype._openImageModal = function () {
    var self = this;
    saveSelection();
    var mask = el('div', { class: 'dz-modal-mask' });
    var modal = el('div', { class: 'dz-modal' });
    var header = el('div', { class: 'dz-modal-header', html: '<span>插入图片</span>' });
    var closeBtn = el('button', { class: 'dz-modal-close', text: '×' });
    header.appendChild(closeBtn);
    var body = el('div', { class: 'dz-modal-body' });

    // 选项卡
    var tabs = el('div', { class: 'dz-modal-tabs' });
    var tabUrl = el('div', { class: 'dz-modal-tab active', text: '网络图片' });
    var tabUpload = el('div', { class: 'dz-modal-tab', text: '本地上传' });
    tabs.appendChild(tabUrl);
    tabs.appendChild(tabUpload);

    // URL 面板
    var urlPanel = el('div');
    var urlInput = el('input', { type: 'url', placeholder: '图片地址 https://...' });
    var altInput = el('input', { type: 'text', placeholder: '图片描述（选填）' });
    urlPanel.appendChild(el('div', { class: 'dz-modal-field' }, [el('label', { text: '图片地址' }), urlInput]));
    urlPanel.appendChild(el('div', { class: 'dz-modal-field' }, [el('label', { text: '图片描述' }), altInput]));

    // 上传面板
    var uploadPanel = el('div', { style: 'display:none;' });
    var uploadArea = el('div', { class: 'dz-upload-area', html: '<div>点击选择图片或拖拽到此处</div><div style="font-size:11px;color:#aaa;margin-top:6px;">支持 PNG、JPG、GIF、WEBP，最大 5MB</div>' });
    var fileInput = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml' });
    uploadArea.appendChild(fileInput);
    var progress = el('div', { class: 'dz-upload-progress', text: '上传中...' });
    uploadPanel.appendChild(uploadArea);
    uploadPanel.appendChild(progress);

    body.appendChild(tabs);
    body.appendChild(urlPanel);
    body.appendChild(uploadPanel);

    var footer = el('div', { class: 'dz-modal-footer' });
    var cancelBtn = el('button', { class: 'dz-modal-btn', text: '取消' });
    var okBtn = el('button', { class: 'dz-modal-btn dz-modal-primary', text: '插入' });
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    mask.appendChild(modal);
    document.body.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('show'); urlInput.focus(); });

    function close() { mask.classList.remove('show'); setTimeout(function () { mask.remove(); }, 200); }

    function insertImg(url, alt) {
      restoreSelection();
      self._focus();
      var html = '<p><img src="' + escapeAttr(url) + '" alt="' + escapeAttr(alt || '图片') + '"></p>';
      document.execCommand('insertHTML', false, html);
      close();
      self.sync();
    }

    tabUrl.addEventListener('click', function () {
      tabUrl.classList.add('active'); tabUpload.classList.remove('active');
      urlPanel.style.display = ''; uploadPanel.style.display = 'none';
      okBtn.textContent = '插入'; urlInput.focus();
    });
    tabUpload.addEventListener('click', function () {
      tabUpload.classList.add('active'); tabUrl.classList.remove('active');
      uploadPanel.style.display = ''; urlPanel.style.display = 'none';
      okBtn.textContent = '上传并插入';
    });

    uploadArea.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) handleUpload(fileInput.files[0]);
    });
    uploadArea.addEventListener('dragover', function (e) { e.preventDefault(); uploadArea.style.background = '#eef5f9'; });
    uploadArea.addEventListener('dragleave', function () { uploadArea.style.background = ''; });
    uploadArea.addEventListener('drop', function (e) {
      e.preventDefault(); uploadArea.style.background = '';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
    });

    var self2 = this;
    function handleUpload(file) {
      if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return; }
      if (file.size > 5 * 1024 * 1024) { alert('图片不能大于 5MB'); return; }
      if (!self.onUploadImage) { alert('未配置图片上传接口'); return; }
      progress.style.display = 'block';
      okBtn.disabled = true;
      self.onUploadImage(file).then(function (res) {
        progress.style.display = 'none';
        okBtn.disabled = false;
        var url = res.url;
        var html = res.html || ('<p><img src="' + url + '" alt="图片"></p>');
        restoreSelection();
        self._focus();
        document.execCommand('insertHTML', false, html);
        close();
        self.sync();
      }).catch(function (err) {
        progress.style.display = 'none';
        okBtn.disabled = false;
        alert((err && err.message) || '上传失败');
      });
    }

    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    okBtn.addEventListener('click', function () {
      if (tabUpload.classList.contains('active')) {
        if (fileInput.files && fileInput.files[0]) handleUpload(fileInput.files[0]);
        else { fileInput.click(); }
        return;
      }
      var url = urlInput.value.trim();
      if (!url) { urlInput.focus(); return; }
      insertImg(url, altInput.value.trim());
    });
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
  };

  /* -------------------- 块级：引用/代码 -------------------- */

  DzEditor.prototype._wrapBlock = function (tag) {
    this._focus();
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      document.execCommand('insertHTML', false, '<' + tag + '><br></' + tag + '>');
      this.sync();
      return;
    }
    var range = sel.getRangeAt(0);
    if (range.collapsed) {
      document.execCommand('insertHTML', false, '<' + tag + '><br></' + tag + '>');
    } else {
      var fragment = range.extractContents();
      var block = document.createElement(tag);
      block.appendChild(fragment);
      range.insertNode(block);
    }
    this.sync();
  };

  DzEditor.prototype._insertCode = function () {
    this._focus();
    var sel = window.getSelection();
    var text = sel && sel.toString() ? sel.toString() : '';
    var html = '<pre><code>' + escapeHtml(text || '在此输入代码') + '</code></pre><p><br></p>';
    if (text) {
      var range = sel.getRangeAt(0);
      range.deleteContents();
    }
    document.execCommand('insertHTML', false, html);
    this.sync();
  };

  /* -------------------- 源码模式 -------------------- */

  DzEditor.prototype._toggleSource = function (btn) {
    if (!this.sourceMode) {
      // 进入源码
      this.sourceArea.value = this.area.innerHTML;
      this.container.classList.add('dz-source-mode');
      this.sourceMode = true;
      btn.classList.add('active');
      this.sourceArea.focus();
    } else {
      // 退出源码
      this.area.innerHTML = this.sourceArea.value;
      this.container.classList.remove('dz-source-mode');
      this.sourceMode = false;
      btn.classList.remove('active');
      this._focus();
      this._updateCharCount();
    }
    this.sync();
  };

  /* -------------------- 事件绑定 -------------------- */

  DzEditor.prototype._bind = function () {
    var self = this;

    // 输入同步 + 字数
    this.area.addEventListener('input', function () {
      self._updateCharCount();
      self.sync();
    });
    this.area.addEventListener('blur', function () { self.sync(); });
    this.sourceArea.addEventListener('input', function () { self.sync(); });

    // 粘贴清理（去除内联样式/类，保留基本结构）
    this.area.addEventListener('paste', function (e) {
      e.preventDefault();
      var html = (e.clipboardData || window.clipboardData).getData('text/html');
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (html) {
        var clean = self._cleanHtml(html);
        document.execCommand('insertHTML', false, clean);
      } else if (text) {
        document.execCommand('insertText', false, text);
      }
      self.sync();
      self._updateCharCount();
    });

    // 拖拽插入图片
    this.area.addEventListener('dragover', function (e) { e.preventDefault(); });
    this.area.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var file = e.dataTransfer.files[0];
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) { alert('图片不能大于 5MB'); return; }
      if (!self.onUploadImage) return;
      self.onUploadImage(file).then(function (res) {
        self._focus();
        var html = res.html || ('<p><img src="' + res.url + '" alt="图片"></p>');
        document.execCommand('insertHTML', false, html);
        self.sync();
      }).catch(function (err) { alert((err && err.message) || '上传失败'); });
    });

    // 工具栏状态同步
    this.area.addEventListener('keyup', function () { self._updateToolbarState(); });
    this.area.addEventListener('mouseup', function () { self._updateToolbarState(); });

    // 点击外部关闭弹层
    document.addEventListener('mousedown', function (e) {
      if (self.popover.classList.contains('show') && !self.popover.contains(e.target) && !e.target.closest('.dz-btn')) {
        self._hidePopover();
      }
    });
  };

  DzEditor.prototype._updateToolbarState = function () {
    var cmds = ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'insertOrderedList', 'insertUnorderedList'];
    var map = { strikeThrough: 'strikethrough' };
    cmds.forEach(function (cmd) {
      var cls = map[cmd] || cmd;
      var btn = this.container.querySelector('.dz-btn[title]');
      // 通过类名匹配较复杂，直接遍历按钮
    }, this);
    // 简化：仅高亮基础按钮
    var buttons = this.container.querySelectorAll('.dz-btn');
    buttons.forEach(function (btn) {
      var title = btn.getAttribute('title');
      var cmdMap = { '加粗': 'bold', '斜体': 'italic', '下划线': 'underline', '删除线': 'strikeThrough', '左对齐': 'justifyLeft', '居中': 'justifyCenter', '右对齐': 'justifyRight', '无序列表': 'insertUnorderedList', '有序列表': 'insertOrderedList' };
      var cmd = cmdMap[title];
      if (!cmd) return;
      try {
        if (document.queryCommandState(cmd)) btn.classList.add('active');
        else btn.classList.remove('active');
      } catch (e) {}
    });
  };

  DzEditor.prototype._updateCharCount = function () {
    var numEl = document.getElementById('dzCharNum');
    if (!numEl) return;
    var text = (this.area.innerText || '').replace(/\u200b/g, '').trim();
    numEl.textContent = text.length;
  };

  /* -------------------- HTML 清理 -------------------- */

  DzEditor.prototype._cleanHtml = function (html) {
    var tmp = el('div', { html: html });
    // 移除 script/style/meta/link
    tmp.querySelectorAll('script,style,meta,link,iframe,object,embed').forEach(function (n) { n.remove(); });
    // 清除内联样式与类名
    tmp.querySelectorAll('*').forEach(function (n) {
      n.removeAttribute('style');
      n.removeAttribute('class');
      n.removeAttribute('id');
      // 移除 on* 事件
      var attrs = n.attributes;
      for (var i = attrs.length - 1; i >= 0; i--) {
        if (attrs[i].name.indexOf('on') === 0) n.removeAttribute(attrs[i].name);
      }
    });
    // 处理 Word 段落
    tmp.querySelectorAll('p').forEach(function (p) {
      if (!p.textContent.trim() && !p.querySelector('img')) p.innerHTML = '<br>';
    });
    return tmp.innerHTML;
  };

  /* -------------------- 公开 API -------------------- */

  DzEditor.prototype.setContent = function (html) {
    this.area.innerHTML = html || '';
    this.sourceArea.value = html || '';
    this._updateCharCount();
    this.sync();
  };

  DzEditor.prototype.getContent = function () {
    if (this.sourceMode) {
      return this.sourceArea.value;
    }
    return this.area.innerHTML;
  };

  DzEditor.prototype.sync = function () {
    if (!this.textarea) return;
    var content = this.sourceMode ? this.sourceArea.value : this.area.innerHTML;
    this.textarea.value = content;
  };

  DzEditor.prototype.destroy = function () {
    if (this.popover && this.popover.parentNode) this.popover.parentNode.removeChild(this.popover);
    this.container.innerHTML = '';
  };

  /* -------------------- 辅助：转义 -------------------- */

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // 暴露到全局
  window.DzEditor = DzEditor;
})();
