from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, MenuItemViewSet, MenuOptionGroupViewSet, MenuOptionViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("items", MenuItemViewSet, basename="menu-item")
router.register("option-groups", MenuOptionGroupViewSet, basename="menu-option-group")
router.register("options", MenuOptionViewSet, basename="menu-option")

urlpatterns = [
    path("", include(router.urls)),
]
