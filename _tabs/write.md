---
title: 写文章
icon: fas fa-pen
order: 8
---

<script>
  var now = new Date();
  var date = now.getFullYear() + '-' 
    + String(now.getMonth()+1).padStart(2,'0') + '-' 
    + String(now.getDate()).padStart(2,'0');
  var time = date + ' ' 
    + String(now.getHours()).padStart(2,'0') + ':' 
    + String(now.getMinutes()).padStart(2,'0') + ':00 +0800';
  var template = '---\ntitle: \ndate: ' + time + '\ncategories: []\ntags: []\n---\n\n';
  var filename = date + '-your-title.md';
  var url = 'https://github.com/WangSimiao2000/wangsimiao2000.github.io/new/main/_posts'
    + '?filename=' + encodeURIComponent(filename)
    + '&value=' + encodeURIComponent(template);
  window.location.href = url;
</script>

正在跳转到 GitHub 编辑器...
