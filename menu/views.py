from rest_framework import filters, permissions, viewsets

from .models import Category, MenuItem
from .serializers import AdminCategorySerializer, AdminMenuItemSerializer, CategorySerializer, MenuItemSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.prefetch_related("items__option_groups__options")
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["sort_order", "name"]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_serializer_class(self):
        if self.request.method in permissions.SAFE_METHODS:
            return CategorySerializer
        return AdminCategorySerializer


class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.select_related("category").prefetch_related("option_groups__options")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "short_description", "description", "allergens"]
    ordering_fields = ["price", "name", "created_at"]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_serializer_class(self):
        if self.request.method in permissions.SAFE_METHODS:
            return MenuItemSerializer
        return AdminMenuItemSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get("category")
        featured = self.request.query_params.get("featured")
        spicy = self.request.query_params.get("spicy")
        vegetarian = self.request.query_params.get("vegetarian")

        if category:
            queryset = queryset.filter(category__slug=category)
        if featured == "true":
            queryset = queryset.filter(featured=True)
        if spicy == "true":
            queryset = queryset.filter(spicy=True)
        if vegetarian == "true":
            queryset = queryset.filter(vegetarian=True)

        # Hidden items are excluded based on who's asking, not on the HTTP
        # method — a staff member doing a plain GET (e.g. loading the admin
        # dashboard's menu manager) must see hidden items too, not only when
        # they happen to be writing.
        if self.request.user.is_staff:
            return queryset
        return queryset.exclude(availability=MenuItem.Availability.HIDDEN)
