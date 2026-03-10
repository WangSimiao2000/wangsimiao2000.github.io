---
title: 小工具
icon: fas fa-toolbox
order: 6
---

<div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
  {% for tool in site.data.tools %}
    {% if tool.name and tool.url %}
      <div class="col">
        <div class="card h-100">
          <div class="card-body d-flex align-items-center">
            {% if tool.icon %}
              <i class="{{ tool.icon }} fa-2x me-3 text-muted"></i>
            {% else %}
              <i class="fas fa-puzzle-piece fa-2x me-3 text-muted"></i>
            {% endif %}
            <div>
              <a href="{{ tool.url }}" class="stretched-link">
                <span class="fw-bold">{{ tool.name }}</span>
              </a>
              {% if tool.description %}
                <div class="text-muted small mt-1">{{ tool.description }}</div>
              {% endif %}
            </div>
          </div>
        </div>
      </div>
    {% endif %}
  {% endfor %}
</div>
