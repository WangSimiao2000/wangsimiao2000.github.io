---
title: 工具
icon: fas fa-toolbox
order: 7
---

<div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4 card-grid">
  {% for tool in site.data.tools %}
    {% if tool.name and tool.url %}
      <div class="col">
        <a href="{{ tool.url }}" class="card h-100 post-preview text-decoration-none card-wrapper card-clickable">
          <div class="card-body d-flex align-items-center card-body-inner">
            {% if tool.icon %}
              <i class="{{ tool.icon }} fa-2x me-3 text-muted"></i>
            {% else %}
              <i class="fas fa-puzzle-piece fa-2x me-3 text-muted"></i>
            {% endif %}
            <div>
              <span class="fw-bold card-title-text">{{ tool.name }}</span>
              {% if tool.description %}
                <div class="text-muted small mt-1">{{ tool.description }}</div>
              {% endif %}
            </div>
          </div>
        </a>
      </div>
    {% endif %}
  {% endfor %}
</div>
