---
title: 友情链接
icon: fas fa-user-friends
order: 6
comments: true
---

<div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
  {% for friend in site.data.friends %}
    {% if friend.name and friend.url %}
      <div class="col">
        <div class="card h-100 post-preview" style="cursor:pointer;" onclick="window.open('{{ friend.url }}','_blank')">
          <div class="card-body d-flex align-items-center" style="position:relative;z-index:1;">
            {% if friend.icon and friend.icon != "" %}
              <img src="{{ friend.icon }}" alt="{{ friend.name }}" class="rounded-circle me-3 flex-shrink-0" width="48" height="48" style="object-fit:cover;" onerror="this.outerHTML='<i class=\'fas fa-globe fa-2x me-3 text-muted\'></i>';" />
            {% else %}
              <i class="fas fa-globe fa-2x me-3 text-muted"></i>
            {% endif %}
            <div>
              <span class="fw-bold" style="color:var(--heading-color);">{{ friend.name }}</span>
              {% if friend.description %}
                <div class="text-muted small mt-1" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{{ friend.description }}</div>
              {% endif %}
            </div>
          </div>
        </div>
      </div>
    {% endif %}
  {% endfor %}
</div>

<hr class="mt-5 mb-4">

<script src="https://giscus.app/client.js"
  data-repo="{{ site.comments.giscus.repo }}"
  data-repo-id="{{ site.comments.giscus.repo_id }}"
  data-category="{{ site.comments.giscus.category }}"
  data-category-id="{{ site.comments.giscus.category_id }}"
  data-mapping="{{ site.comments.giscus.mapping | default: 'pathname' }}"
  data-strict="{{ site.comments.giscus.strict | default: '0' }}"
  data-reactions-enabled="{{ site.comments.giscus.reactions_enabled | default: '1' }}"
  data-emit-metadata="0"
  data-input-position="{{ site.comments.giscus.input_position | default: 'bottom' }}"
  data-theme="preferred_color_scheme"
  data-lang="{{ site.comments.giscus.lang | default: site.lang }}"
  crossorigin="anonymous"
  async>
</script>
