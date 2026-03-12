---
title: 相册
icon: fas fa-camera-retro
order: 5
---

<style>
.g-item { margin-bottom: 12px; cursor: pointer; }
.g-item img { width: 100%; border-radius: 6px; display: block; }
.lb { display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.9); justify-content:center; align-items:center; }
.lb.on { display:flex; }
.lb img { max-width:92vw; max-height:90vh; border-radius:6px; }
.lb-x { position:absolute; top:12px; right:16px; background:none; border:none; color:#fff; font-size:2rem; cursor:pointer; }
</style>

<div class="lb" id="lb" onclick="closeLB()">
  <button class="lb-x" aria-label="关闭">&times;</button>
  <img id="lb-img" alt="" onclick="event.stopPropagation()" />
</div>

{% if site.data.gallery.size > 0 %}
  {% for photo in site.data.gallery %}
  <div class="g-item" onclick="openLB('{{ photo.image }}')">
    <img src="{{ photo.image }}" alt="照片" loading="lazy" />
  </div>
  {% endfor %}
{% else %}
<p class="text-muted text-center mt-5">📷 还没有照片</p>
{% endif %}

<script>
var lb=document.getElementById('lb'), lbImg=document.getElementById('lb-img');
function openLB(s){lbImg.src=s;lb.classList.add('on');document.body.style.overflow='hidden';}
function closeLB(){lb.classList.remove('on');document.body.style.overflow='';}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLB();});
</script>
